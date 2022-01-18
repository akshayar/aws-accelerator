import sys
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql.functions import *

if __name__ == "__main__":

    source_path = sys.argv[1]
    target_path = sys.argv[2]
    table_name = sys.argv[3]

    spark = SparkSession \
            .builder \
            .config("hive.metastore.client.factory.class",
                    "com.amazonaws.glue.catalog.metastore.AWSGlueDataCatalogHiveClientFactory") \
            .appName("EMRServerless") \
            .enableHiveSupport() \
            .getOrCreate()


    print("Table Name: " + sys.argv[3])

    weatherInCsv = spark.read.option("inferSchema", "true").option("header", "true").csv(source_path)

    weatherWithCurrentDate = weatherInCsv.withColumn("current_date", lit(datetime.now()))

    weatherWithCurrentDate.printSchema()

    print(weatherWithCurrentDate.show())

    print("Total number of records: " + str(weatherWithCurrentDate.count()))

    weatherWithCurrentDate.write.mode("overwrite").option("path", target_path).saveAsTable(table_name)

    spark.sql("select * from " + table_name).show()
