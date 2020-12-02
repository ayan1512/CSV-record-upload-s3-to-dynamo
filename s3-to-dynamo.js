
    const AWS = require('aws-sdk');
    const documentClient = new AWS.DynamoDB.DocumentClient();
    const S3 = new AWS.S3({
        maxRetries: 0,
        region: 'eu-central-1',//change as per your AWS s3 region
    });
    
    const insertSuccess = 0;
    const insertErrors = 0;
    
    function dynamoResultCallback(err, data) {
        if (err) {
            insertErrors++;
            console.log("Insert Error: \n" + err);
            //console.log(err, err.stack); // an error occurred
        } else {
            insertSuccess++;
        }
    }

    //CONVERT TO JSON FUNCTION
    function csvJSON(csv){
        var lines=csv.split('\r');
        for(var i = 0; i<lines; i++){
            lines[i] = lines[i].replace(/\s/,'');//delete all blanks
        }
        var result = [];
        var headers=lines[0].split(",");
       
        for(var i=1;i<lines.length-1;i++){
            var item = {};
            var currentline=lines[i].split(",");
            for(var j=0;j<headers.length;j++){
                
                var headerItems=[];
                var elementItems=[];
                if(headers[j]!==undefined)
                headerItems=headers[j].toString().split(";");
                if(currentline[j]!==undefined)
                elementItems=currentline[j].toString().split(";");
                for(let k=0;k<headerItems.length;k++){
                   if(headerItems[k]!==undefined && elementItems[k]!==undefined){
                        
                        item[headerItems[k].toString().trim()]=elementItems[k].toString().trim(); 
                   }
                }
            }
          console.log('item');
          console.log(item);
          result.push(item);
        }
        return result;
    }
    
    exports.handler = (event, context, callback) => {

        var srcBucket = event.Records[0].s3.bucket.name;
        var srcKey = event.Records[0].s3.object.key;
        let tableName=srcKey.slice(0, -4);
        console.log(srcKey);
        
        S3.getObject({
            Bucket: srcBucket,
            Key: srcKey,
        }, 
        function(err, data) {
            if (err !== null) {
                console.log(err);
                return callback(err, null);
            }
            var fileData = data.Body.toString('utf-8');  
            var obj=[];
            obj = csvJSON(fileData);
            var batches = [];
            var current_batch = [];
            for (var i = 0; i < obj.length; i++) {
                current_batch.push({
                    PutRequest: {
                      Item: obj[i]
                    }
                 });
               
            }
            var chunk=25;
            while (current_batch.length > 0)
                batches.push(current_batch.splice(0, chunk));
            
            var params;
            for(let x in batches) {
                params = '{"RequestItems": {"' + tableName + '": []}}';
                params = JSON.parse(params);
                params.RequestItems[tableName] = batches[x];
                    documentClient.batchWrite(params, function(err, data) {
                    if (err) {
                        console.log(err);
                        callback(err);
                    } else {
                        callback(null, data);
                    }
                });
            }
          
        });
    };
