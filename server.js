var express = require('express');
var app= express();
var session = require('express-session');
var compression = require('compression');
var async = require('async');

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

//

//CREATE TABLE users (
//    id       INTEGER    PRIMARY KEY AUTOINCREMENT
//                        UNIQUE
//                        NOT NULL,
//    pseudo   TEXT (50)  UNIQUE
//                        NOT NULL,
//    password TEXT (100) NOT NULL,
//    mail     TEXT (200) UNIQUE
//                        NOT NULL
//);

//CREATE TABLE dirlabs (
//    id_user INTEGER,
//    id_labo INTEGER
//);

//CREATE TABLE labo (
//    id  INTEGER PRIMARY KEY AUTOINCREMENT,
//    nom TEXT
//);

//CREATE TABLE membres_labo (
//    id_user INTEGER,
//    id_labo INTEGER
//);




//Database
var sqlite3 = require("sqlite3");
var db = new sqlite3.Database('database.sqlite');

var sha256 = require('sha256');


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



app.get('/admin',function(req,res){
	//interface management super admin
	res.end('reservé remi / bastien');
});

app.post('/admin/add/labo',function(req,res){
	//crée un labo et ajoute un ou plusieurs dirlabs
	res.end('ok');
});

app.get('/dirlab',isAuthenticated,isDirlab,function(req,res){
	result=[];
	db.all('Select id_labo from dirlabs where id_user=?',req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labo where id=?',data.id_labo,function(e,r){
				result.push({id:data.id_labo,nom:r.nom});
				callback();
			});
		},function(){
			res.end(JSON.stringify(result));
		});
	});
});

app.get('/dirlab/:labo',isAuthenticated,isDirlab,function(req,res){
	
});

//app.get('/dirlab/:startup/:')

//app.get('/admin/projects',function(req,res){

//});
app.get('/laboratoires',isAuthenticated,function(req,res){
	result=[];
	db.all('Select id_labo from membres_labo where id_user=?',req.session.user.id,function(err,row){
		async.each(row,function(data,callback){
			db.get('Select nom from labo where id=?',data.id_labo,function(e,r){
				result.push({id:data.id_labo,nom:r.nom});
				callback();
			});
		},function(){
			res.end(JSON.stringify(result));
		});
	});
});

app.get('/laboratoire/:id',isAuthenticated,function(req,res){
	laboId=parseInt(req.params.id);
	db.get("select id_projet from membres_projet where id_user=? and id_labo=?",req.session.user.id,laboId,function(err,row){
		res.end(JSON.stringify(row.id_projet));
	});
});

app.post('/laboratoires/:id',isAuthenticated,function(req,res){

});


// Run Server ! 
var server= app.listen(3000,function(){
	var host = server.address().address;
	var port = server.address().port;
	console.log("Running !");
});