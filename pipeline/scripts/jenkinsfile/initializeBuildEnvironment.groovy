/**
 * script/jenkinsfile/initializeBuildEnvironment.groovy
 *
 * Description: Common script to initialize the build environment
 * Input: Boolean installWithBrightside: A boolean that indicates if brightside should also be installed
 */

def call(Boolean installWithBrightside = true) {
    sh "echo 'jenkins' | sudo -S apt-get install -y nodejs"
    sh "npm install npm --global"

    // Install gulp cli so we can build.
    sh "npm install"

    if (installWithBrightside) {
        sh "npm run global-install"
    } else {
        sh "npm run global-install -- --no-brightside"
    }

    dir('webserver'){
        sh "chmod +x gradlew"
    }

    sh "cp gulpExample.properties.yaml gulp.properties.yaml"
}

return this
