The template is doing following -
1. Creates a Event Bridge rule which is triggered when AWS Config rule "desired-instance-type" reports a violation. 
2. The target of rule is a SSM Automation - AWS-TerminateEC2Instance which terminates the reported instances. 
3. Another target is a SNS topic with email subscription. 
