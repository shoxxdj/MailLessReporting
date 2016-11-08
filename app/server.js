var express = require('express');
var app= express();
var session = require('express-session');
var compression = require('compression');
var async = require('async');
var sha256 = require('sha256');

var jsDate=require("js-date");

var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('database.sqlite');
//var helmet = require('helmet')
//app.use(helmet())
//Body Parser
var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
 
app.use(express.static(__dirname+'/public'));
app.use(session({
                secret: 'YManagementTool',
                name: 'YetAnOtherBullshitManagementTool'
        }));

var isAuthenticated = function(req,res,next){
	if(req.session.user)
		return next();
	else
		res.redirect('/');
}

var isNotAuthenticated = function(req,res,next){
	if(!req.session.user)
		return next();
	else	
		res.redirect('/logoff');
}

var isUserAllowedToAccessLabo = function(req,res,next){
	laboId=parseInt(req.params.id);
	db.get('select id_user from membres_labo where id_user=? and id_labo=?',req.session.user.id,laboId,function(err,row){
		 if(row==='undefined' || typeof(row) == 'undefined'){
		 	res.redirect('/rules');
		 }
		 else{
		 	next();
		 }
	});
}

var isAllowedToRepport = function(req,res,next){
	/*if(new Date().getDay()<3 || new Date().getDay()>5){
		res.redirect('/rules');
	}
	else{
		next();
	}*/
	next();
}
var hasAllreadyReport = function(req,res,next){
	userId=parseInt(req.session.user.id);
	labId=parseInt(req.params.id);
	date=getWeekNumber();
	db.get('select rapport from rapports where id_user=? and id_labo=? and date=?',userId,labId,date,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			next();
		}
		else{
			res.redirect('/rules');
		}
	});
}

var isDirlab = function(req,res,next){
	if(req.session.user.dirlab===true){
		next();
	}
	else{
		db.get("Select id_user from dirlabs where id_user=?",req.session.user.id,function(err,row){
			if(row==='undefined' || typeof(row) == 'undefined'){
				res.redirect('/');
			}
			else{
				req.session.user.dirlab=true;
				next();
			}
		});
	}
}

var isAdmin = function(req,res,next){
	db.get("select id_user from admins where id_user=?",req.session.user.id,function(err,row){
		if(row==="undefined" || typeof(row)=='undefined'){
			res.redirect('/');
		}
		else{
			next();
		}
	})
}

function getWeekNumber() {
    d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    var yearStart = new Date(d.getFullYear(),0,1);
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

var isDirlabOfLabo = function(req,res,next){
	laboId = parseInt(req.params.id);
	db.get('select id_labo from dirlabs where id_user=? and id_labo=?',req.session.user.id,laboId,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			res.end("Hmm Hmm T'est pas chez toi !");
		}
		else{
			next();
		}
	});
}

app.get('/',function(req,res){
	if(!req.session.user){
		res.render('home.ejs');
	}
	else{
		res.redirect('/laboratoires');
	}
});
/*app.get('/register',function(req,res){
	res.render('register.ejs');
});
app.post('/register',isNotAuthenticated,function(req,res){

	password = sha256(req.body.password);
	password_verif = sha256(req.body.password_verif);

	if(password!=password_verif){
		res.render('register.ejs',{error:"Les mots de passe doivent etre identiques"});
	}
	else{
		pseudo = req.body.pseudo;
		mail  = req.body.mail;
		db.get("Select id from users where pseudo = ? or mail = ?",pseudo,mail,function(err,row){
			if(row==='undefined' || typeof(row) == 'undefined'){
				console.log('ok');
				var p_req = db.prepare("INSERT INTO users(pseudo,mail,password) VALUES (?,?,?)");
				p_req.run(pseudo,mail,password);
				res.end('ok');
			}
			else{
				console.log(row);
				res.render('register.ejs',{error:"Un utilisateur existe déjà avec le pseudo ou e-mail"});
			}
		});
	}
});
*/
app.get('/login',function(req,res){
	res.render('login.ejs');
});
app.post('/login',function(req,res){
	var mail = req.body.mail;
	var password = sha256(req.body.password);

	db.get('Select id,mail from users where mail=? and password=?',mail,password,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			res.end('STFU MOFO');
		}
		else{
			req.session.user={id:row.id,mail:row.mail,isdirlab:false};
			res.redirect('/');
		}
	});
});
app.get('/logoff',isAuthenticated,function(req,res){
	req.session.user=false;
	res.redirect('/');
});

app.get('/rules',function(req,res){
	res.render('rules.ejs');
});

app.get('/laboratoires',isAllowedToRepport,isAuthenticated,function(req,res){
	result=[];
	db.all('Select id_labo from membres_labo where id_user=?',req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labos where id=?',data.id_labo,function(e,r){
				result.push({id:data.id_labo,nom:r.nom});
				callback();
			});
		},function(){
			res.render('user/index.ejs',{datas:result});
		});
	});
});
app.get('/laboratoire/:id',isAuthenticated,isUserAllowedToAccessLabo,function(req,res){
	laboId=parseInt(req.params.id);
	db.get('Select nom from labos where id=?',laboId,function(err,row){
		res.render('user/rapport.ejs',{nom:row.nom});
	});
});
app.post('/laboratoire/:id',isAuthenticated,isAllowedToRepport,function(req,res){
	rapport = req.body.rapport;
	laboId=parseInt(req.params.id);
	date = getWeekNumber();

	db.get('Select rapport from rapports where id_user=? and date=?',req.session.user.id,date,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			var insert = db.prepare('INSERT into rapports(date,id_user,id_labo,rapport) values (?,?,?,?)');
			insert.run(date,req.session.user.id,laboId,rapport,function(e){
				res.end('done');
			});
		}
		else{
			res.render('rules.ejs');
		}
	});
});
app.get('/dirlab',isAuthenticated,isDirlab,function(req,res){
	var result = [];
	db.all("select id_labo from dirlabs where id_user=?",req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labos where id=?',data.id_labo,function(e,r){
				result.push({id:data.id_labo,nom:r.nom});
				callback();
			});
		},function(){
			res.render('dirlab/index.ejs',{datas:result});
		});
	});
});

//Dirlab
//
// Voir la liste de ses étudiants
// Possiblité de voir les rapports des semaines précédantes

app.get('/dirlab/laboratoire/:id',isAuthenticated,isDirlab,isDirlabOfLabo,function(req,res){
	laboId=req.params.id;
	date = getWeekNumber();
	var result = [];
	var users = [];
	db.all('select id_user from membres_labo where id_labo=?',laboId,function(e,r){
		if(r!=null){
			async.each(r,function(userId,callback){
				db.get('Select mail from users where id=?',userId.id_user,function(f,g){
					db.get('select rapport from rapports where id_user=? and id_labo=? and date=?',userId.id_user,laboId,date,function(h,i){
						if(i==='undefined' || typeof(i) == 'undefined'){
							callback();
						}
						else{
							result.push({id_user:r.id_user,mail_user:g.mail,rapport:i.rapport});
							callback();
						}
					});
				})
			},function(){
				db.all('select id,mail from users',function(err,row){
					async.each(row,function(user,c){
						users.push({id:user.id,mail:user.mail});
						c();
					},function(){
						res.render('dirlab/rapports.ejs',{datas:result,semaine:date,users:users,id:laboId});
					});
				});
			});
		}
		else{
			res.end('0 rapports');
		}
	});
});

app.post('/dirlab/usertolab/:id',isAuthenticated,isDirlab,isDirlabOfLabo,function(req,res){
	var labId= parseInt(req.params.id);
	var userId = parseInt(req.body.user_id);

	db.get('select id_user from membres_labo where id_user=? and id_labo=?',labId,userId,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			var insert = db.prepare('INSERT into membres_labo (id_user,id_labo) VALUES (?,?)');
			insert.run(userId,labId);
			res.end('ok'); 
		}
		else{
			res.end("L'utilisateur est déja dans votre labo !");
		}
	});
});

app.get('/admin',isAuthenticated,isAdmin,function(req,res){
	var users=[];
	var labos=[];
	db.all('select id,mail from users',function(err,row){
		async.each(row,function(user,callback){
			users.push({id:user.id,mail:user.mail});
			callback();
		},function(){
			db.all('select id,nom from labos',function(err,row){
				async.each(row,function(labo,c){
					labos.push({id:labo.id,nom:labo.nom});
					c();
				},function(){
					res.render('admin/index.ejs',{users:users,labos:labos});
				});
			});
		});
	});
});

app.post('/admin/newlab',isAuthenticated,isAdmin,function(req,res){
	var lab = req.body.nom;
	var insert = db.prepare('INSERT into labos (nom) VALUES (?)');
	insert.run(lab);
	res.end('ok');
});

app.post('/admin/newdirlab',isAuthenticated,isAdmin,function(req,res){
	var labId= req.body.laboratoire_id;
	var userId = req.body.user_id;

	var insert = db.prepare('INSERT into dirlabs (id_user,id_labo) VALUES (?,?)');
	insert.run(userId,labId);
	res.end('ok');
});

app.post('/admin/usertolab',isAuthenticated,isAdmin,function(req,res){
	var labId= req.body.laboratoire_id;
	var userId = req.body.user_id;

	db.get('select id_user from membres_labo where id_user=? and id_labo=?',labId,userId,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			var insert = db.prepare('INSERT into membres_labo (id_user,id_labo) VALUES (?,?)');
			insert.run(userId,labId);
			res.end('ok'); 
		}
		else{
			res.end("L'utilisateur est déja dans ce labo !");
		}
	});
});



/*var server_port = process.env.OPENSHIFT_NODEJS_PORT || 8080
var server_ip_address = process.env.OPENSHIFT_NODEJS_IP || '127.0.0.1'
 
var server = app.listen(server_port, server_ip_address, function () {
  console.log( "Listening on " + server_ip_address + ", port " + server_port )
});*/


// Run Server ! 
var server= app.listen(8080,function(){
	var host = server.address().address;
	var port = server.address().port;
	console.log("Running !");
});
