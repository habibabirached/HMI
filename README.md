# Data Center Simulator

## project structure
- dcs-ui is the main app
- dcs-cicd is used in the demo server to update the code when changes are detected in github. For this to work properly, the services must be started as **root** in the VM folder /opt/DataCenterSimulator

## localhost development
For running and testing the local in your local machine

### clone
```
git clone git@github.apps.gevernova.net:212336564/DataCenterSimulator.git
```

### build and run

```
cd dcs-ui
./docker-dev-build.sh && ./docker-dev-run.sh
```

### stop service

```
./docker-dev-stop.sh
```

## demo machine
We have deployed the UI to the ARC AWS VM location: http://10.202.252.31:3000/
The app has been started using the docker-demo-run.sh which also runs a CICD cron job that keeps its code updated. However, changes in package.json must be followed by build & restart since it requires a new docker image to be built with the new libraries.

### build and run
within the VM...
```
cd /opt/DataCenterSimulator
./docker-demo-build.sh && ./docker-demo-run.sh
```

### stop services
Within the VM...
```
cd /opt/DataCenterSimulator
docker-demo-stop.sh
```

# Requirements
We keep the simulator requirements, including screenshots and data at box:
https://gevernova.ent.box.com/folder/355646361421?s=4jjwmpk8lc82b8wbdthssjukf7373a25

More information is also available at: **Data Center Modeling** project main Box folder: https://gevernova.ent.box.com/folder/351170618336?s=7in38tk50olffa7l4bj7awv3juxljrx4

