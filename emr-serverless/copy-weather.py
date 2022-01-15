import sys
from datetime import datetime

from pyspark.sql import SparkSession
from pyspark.sql.functions import *

if __name__ == "__main__":

    spark = SparkSession \
        .builder \
        .appName("EMRServerless") \
        .enableHiveSupport() \
        .getOrCreate()

    print("Table Name: " + sys.argv[3])

    weatherIn = spark.read.option("inferSchema", "true").option("header", "true").csv(sys.argv[1])

    weatherWithCurrentDate = weatherIn.withColumn("current_date", lit(datetime.now()))

    weatherWithCurrentDate.printSchema()

    print(weatherWithCurrentDate.show())

    print("Total number of records: " + str(weatherWithCurrentDate.count()))

    #weatherWithCurrentDate.write.parquet(sys.argv[2])

    weatherWithCurrentDate.write.mode("overwrite").option("path", sys.argv[2]).saveAsTable(sys.argv[3])

    spark.sql("select * from "+sys.argv[3]).show()
