Y-LabManagement

Docker :
- https://github.com/shoxxdj/MailLessReporting.git
- cd MailLessReporting
- docker build -t yapp .
- docker run -it -p 8080:8080 -v "$PWD"/app:/usr/src/app yapp

Go to http://localhost:8080

Default users 
 - user1@ynov.com:user1
 - dirlab1@ynov.com:dirlab1

