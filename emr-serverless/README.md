# Refrences
https://docs.aws.amazon.com/emr/latest/EMR-Serverless-UserGuide/getting-started.html
# Prerequisite
1. Add support for new endpoint for EMR Serverless with name emr-serverless. Congigure region and test the API for emr-serverless. 
```shell
aws s3 cp s3://elasticmapreduce/emr-serverless-preview/artifacts/latest/dev/cli/service.json ./service.json
aws configure add-model --service-model file://service.json

aws configure set region us-east-1
aws emr-serverless list-applications
```

# Create EMR Serverless Cluster
1. Create Job execution role 
```shell
BUCKET_NAME=akshaya-emr-workshop
aws cloudformation deploy --template-file ./emr-serverless-role.yaml \
--stack-name emr-serverless-execution-role \
--parameter-overrides RoleName=emr-serverless-job-role TargetBucket=akshaya-emr-workshop \
--capabilities CAPABILITY_NAMED_IAM --region us-east-1

ROLE_ARN=`aws iam get-role --role-name emr-serverless-job-role --query Role.Arn --output text`
```
2. Create the EMR Serverless Application for Spark. The application gets created with an Initial Capacity. The Initial Capacity be default is of 3 drivers each with - 4 vCPU, 16 GB Memory, 21 GB Storage  and 9 workers each with - 4 vCPU, 16 GB Memory, 21 GB Storage. 
```shell
aws emr-serverless create-application \
    --release-label emr-6.5.0-preview \
    --type 'SPARK' \
    --name my-application
    
aws emr-serverless list-applications

APPLICATION_ID=`aws emr-serverless list-applications --query applications[0].id --output text`

aws emr-serverless get-application \
    --application-id ${APPLICATION_ID}
```

3. Start Application and wait for application to get into "started" state.
```shell
aws emr-serverless start-application \
    --application-id ${APPLICATION_ID}

aws emr-serverless get-application     --application-id $APPLICATION_ID --query application.state --output text
```

## Run Sample Jobs on Application
1. Submit Job once the application is in started state. 
```shell
aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "sparkSubmit": {
            "entryPoint": "s3://us-east-1.elasticmapreduce/emr-containers/samples/wordcount/scripts/wordcount.py",
            "entryPointArguments": ["s3://akshaya-emr-workshop/output"],
            "sparkSubmitParameters": "--conf spark.executor.cores=1 --conf spark.executor.memory=4g --conf spark.driver.cores=1 --conf spark.driver.memory=4g --conf spark.executor.instances=1"
        }
    }' \
    --configuration-overrides '{
        "monitoringConfiguration": {
           "s3MonitoringConfiguration": {
             "logUri": "s3://akshaya-emr-workshop/logs"
           }
        }
    }'

JOB_RUN_ID=<JOB-RUN-ID> 

aws emr-serverless list-job-runs --application-id $APPLICATION_ID

aws emr-serverless get-job-run --application-id $APPLICATION_ID --job-run-id ${JOB_RUN_ID} --query jobRun.state --output text

aws s3 cp s3://akshaya-emr-workshop/logs/applications/$APPLICATION_ID/jobs/${JOB_RUN_ID}/SPARK_DRIVER/stdout.gz .

cat stdout.gz | gunzip

```

## Run Job with Glue Catalog Integration
1. Copy sample trip data and code to the S3 bucket.
```shell
aws s3 cp "s3://nyc-tlc/trip data/yellow_tripdata_2020-04.csv" s3://akshaya-emr-workshop/input/
```
2. Refer to the PySaprk code in copy-data.py. It reads data from CSV files in source directory 
   and copies that to a target directory in Parquet format. It also creates a Hive table which 
   is synched with Glue catalog. Submit the job.
   
```shell
aws s3 cp <path-to-pyspark-script> s3://akshaya-emr-workshop/pyspark/copy-data.py

JOB_RUN_ID=`aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "sparkSubmit": {
            "entryPoint": "s3://akshaya-emr-workshop/pyspark/copy-data.py",
            "entryPointArguments": ["s3://akshaya-emr-workshop/input","s3://akshaya-emr-workshop/output","default.trip_data_table"],
            "sparkSubmitParameters": "--conf spark.executor.cores=1 --conf spark.executor.memory=4g --conf spark.driver.cores=1 --conf spark.driver.memory=4g --conf spark.executor.instances=1 "
        }
    }' \
    --configuration-overrides '{
        "monitoringConfiguration": {
           "s3MonitoringConfiguration": {
             "logUri": "s3://akshaya-emr-workshop/logs"
           }
        }
    }' --query jobRunId --output text`
  
 JOB_RUN_ID=<JOB-RUN-ID> 
 
 aws emr-serverless list-job-runs --application-id $APPLICATION_ID

 aws emr-serverless get-job-run --application-id $APPLICATION_ID --job-run-id ${JOB_RUN_ID}
 
 
 aws s3 cp --recursive s3://akshaya-emr-workshop/logs/applications/$APPLICATION_ID/jobs/${JOB_RUN_ID}/SPARK_DRIVER/ ${JOB_RUN_ID}

 cat ${JOB_RUN_ID}/stdout.gz | gunzip
 
 cat ${JOB_RUN_ID}/stderr.gz | gunzip
 
 ## Start job run without sparkSubmitParameters
 JOB_RUN_ID=`aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "sparkSubmit": {
            "entryPoint": "s3://'${S3_BUCKET}'/pyspark/copy-data.py",
            "entryPointArguments": ["s3://noaa-gsod-pds/2021/","s3://'${S3_BUCKET}'/output/noaa_gsod_pds","default.noaa_gsod_pds"]
            
        }
    }' \
    --configuration-overrides '{
        "monitoringConfiguration": {
           "s3MonitoringConfiguration": {
             "logUri": "s3://'${S3_BUCKET}'/logs"
           }
        }
    }' --query jobRunId --output text`
 
 
 
```

3. Go to Glue Catalog and check that a table gets created in default database by name trip_data_table. 
4. Query the table from athena -
```roomsql
select * from default.trip_data_table 
```

## Execute Spark Streaming Job
1.  Spark streaming from Kinesis source does not work yet as the jobs can not access a public endpoint. Right now it only support read/write from S3 and Glue.

```shell

aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "sparkSubmit": {
            "entryPoint": "s3://akshaya-emr-workshop/Spark-Structured-Streaming-Kinesis-Hudi-assembly-1.0.jar",
            "entryPointArguments": ["akshaya-emr-workshop","data-stream-ingest","us-east-1", "COW","serverless_parquet_table","ASIA3UFLO33MYMZTXY4V","TfEYjrzL4owx1qIMyp7upeL2y/EStV+Cz4bYNpRl","IQoJb3JpZ2luX2VjELz//////////wEaCXVzLWVhc3QtMSJGMEQCICsjuMbWDn2/zFfYkVvjgnILYate/nSAEApGrlTpFyn5AiBInzb6AgHTG91eoA+7v2RbjciaMag8UeT/PhUsfh496SqfAgjV//////////8BEAEaDDc5OTIyMzUwNDYwMSIMQrClpglTc5CIukreKvMB1zZgNxBh0BUHoT5gl8auPzZoBR+LAcxQ/TXtFiSxVYFmYGHXmG4zOQUmoNkvRMH+/gRQ6sv4Yulv8mPVbMPvxhNyWOCaCAfmnd7fExcyJoNYIGvQ++aPSWO2U9pHqAo4QY0JyH02JHtmuOwJB7Tn9ifwxC7JrzFkWzYYZOwrVpTJDO6oNNr627E4+serLcVCrtkNU9RjnXudEG5aANhakLJ2kcNE8asMPCm419d2uFNDbjH8H9Z+ofqcrhpoMpssG8Krrov0YQIPW/OCehzyNmEE5MB1k6+7cdM1S+XA4Lhc2DuhdunLfQzukeTHOzPUoGHJMKzKmo8GOp4BV+Se5jYT6Bvp3yIZ7TZnbXYaCFbMWEcmYnUJYzLuKjH2W8gUYnnCH177WR9fbruLn5XxTKrUXoZ/+tTWTnYKoHWsN8Wxx35SilrL7hEC6uU3WnBb2TeN7nkB4YYDNt/bq7ORzhjtEKm+y2VVt4DQCLJwU2bDU1vnXblon4vch8SD7mPxvweBXVhJUF66iNrLJGIfgQLiOrBUSlhn5Tw="],
            "sparkSubmitParameters": "--conf spark.jars=s3://akshaya-emr-workshop/spark-sql-kinesis_2.12-1.2.0_spark-3.0.jar,s3://akshaya-emr-workshop/spark-streaming-kinesis-asl_2.12-3.1.1.jar --conf spark.executor.cores=2 --conf spark.executor.memory=4g --conf spark.driver.cores=1 --conf spark.driver.memory=4g --conf spark.executor.instances=1 --class kinesis.parquet.latefile.SparkKinesisConsumerParquetProcessor"
        }
    }' \
    --configuration-overrides '{
        "monitoringConfiguration": {
           "s3MonitoringConfiguration": {
             "logUri": "s3://akshaya-emr-workshop/logs"
           }
        }
    }'
    
    
    aws emr-serverless start-job-run \
    --application-id ${APPLICATION_ID} \
    --execution-role-arn ${ROLE_ARN} \
    --job-driver '{
        "sparkSubmit": {
            "entryPoint": "s3://akshaya-emr-workshop/Spark-Structured-Streaming-Kinesis-Hudi-assembly-1.0.jar",
            "entryPointArguments": ["akshaya-emr-workshop","data-stream-ingest","us-east-1", "COW","serverless_parquet_table","'${ROLE_ARN}'","session-test","e"],
            "sparkSubmitParameters": "--conf spark.jars=s3://akshaya-emr-workshop/spark-sql-kinesis_2.12-1.2.0_spark-3.0.jar,s3://akshaya-emr-workshop/spark-streaming-kinesis-asl_2.12-3.1.1.jar --conf spark.executor.cores=2 --conf spark.executor.memory=4g --conf spark.driver.cores=1 --conf spark.driver.memory=4g --conf spark.executor.instances=1 --class kinesis.parquet.latefile.SparkKinesisConsumerParquetProcessor"
        }
    }' \
    --configuration-overrides '{
        "monitoringConfiguration": {
           "s3MonitoringConfiguration": {
             "logUri": "s3://akshaya-emr-workshop/logs"
           }
        }
    }'
    

```