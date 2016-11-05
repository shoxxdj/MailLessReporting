var express = require('express');
var app= express();
var session = require('express-session');
var compression = require('compression');
var async = require('async');
var sha256 = require('sha256');

var jsDate=require("js-date");

var sqlite3 = require('sqlite3');
var db = new sqlite3.Database('database.sqlite');

//Body Parser
var bodyParser = require('body-parser');
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
})); 
 
app.use(express.static(__dirname+'/public'));
app.use(session({
                secret: 'mofo',
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
		console.log(err);
		console.log(row);
		 if(row==='undefined' || typeof(row) == 'undefined'){
		 	res.redirect('/');
		 }
		 else{
		 	next();
		 }
	});
}

var isAllowedToRepport = function(req,res,next){
	if(new Date().getDay()<3 ){/*|| new Date().getDay()>5*/
		res.redirect('/rules');
	}
	else{
		next();
	}
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

function getWeekNumber() {
    d = new Date();
    d.setHours(0,0,0,0);
    d.setDate(d.getDate() + 4 - (d.getDay()||7));
    var yearStart = new Date(d.getFullYear(),0,1);
    var weekNo = Math.ceil(( ( (d - yearStart) / 86400000) + 1)/7);
    return weekNo;
}

var isDirlabOfLabo = function(req,res,next){
	laboId = req.params.id;
	db.get('select id_labo where id_user=? and id_labo=?',req.session.user.id,laboId,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			res.end('Not Allowed');
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
app.get('/register',function(req,res){
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
app.get('/login',function(req,res){
	res.render('login.ejs');
});
app.post('/login',function(req,res){
	var mail = req.body.mail;
	var password = sha256(req.body.password);

	db.get('Select id,pseudo,mail from users where mail=? and password=?',mail,password,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			res.end('STFU MOFO');
		}
		else{
			req.session.user={id:row.id,pseudo:row.pseudo,mail:row.mail,isdirlab:false};
			res.redirect('/');
		}
	});
});
app.get('/laboratoires',isAuthenticated,function(req,res){
	result=[];
	db.all('Select id_labo from membres_labo where id_user=?',req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labo where id=?',data.id_labo,function(e,r){
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
	db.get('Select nom from labo where id=?',laboId,function(err,row){
		res.render('user/rapport.ejs',{nom:row.nom});
	});
});
app.post('/laboratoire/:id',isAuthenticated,isAllowedToRepport,function(req,res){
	rapport =  req.body.rapport;
	laboId=parseInt(req.params.id);
	date = jsDate.date("Y/m/d");

	db.get('Select rapport from rapports where id_user=? and date=?',req.session.user.id,date,function(err,row){
		if(row==='undefined' || typeof(row) == 'undefined'){
			var insert = db.prepare('INSERT into rapports(date,id_user,id_labo,rapport) values (?,?,?,?)');
			insert.run(date,req.session.user.id,laboId,rapport,function(e){
				res.end('done');
			});
		}
		else{
			res.render('user/rules.ejs',{message:'Un rapport par semaine pas plus'});
		}
	});
});

app.get('/dirlab',isAuthenticated,isDirlab,function(req,res){
	var result = [];
	db.all("select id_labo from dirlabs where id_user=?",req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labo where id=?',data.id_labo,function(e,r){
				result.push({id:data.id_labo,nom:r.nom});
				callback();
			});
		},function(){
			res.render('dirlab/index.ejs',{datas:result});
		});
	});
})

app.get('/dirlab/laboratoire/:id',isAuthenticated,isDirlab,isDirlabOfLabo,function(req,res){
	laboId=req.params.id;
	db.all('Select id_user from membres_labo where id_labo=?',)
});

// Run Server ! 
var server= app.listen(3000,function(){
	var host = server.address().address;
	var port = server.address().port;
	console.log("Running !");
});