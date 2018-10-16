/**
 * script/jenkinsfile/disMainframeDeploy.groovy
 *
 * Description: Deploy product to designated host.
 * Input: String agentLabel: Build agent label
 */

def call(String agentLabel) {
    node(agentLabel){
        echo 'start mainframe deployment'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize()

        try {
            instanceName = sh returnStdout: true, script: "gulp properties --instanceName --silent"
            template = sh returnStdout: true, script: "gulp properties --template --silent"
            id = sh returnStdout: true, script: "gulp properties --id --silent"
            propertiesPath = sh returnStdout: true, script: "gulp properties --WASProperties --silent"

            // Initialize BrightSide profiles
            withCredentials([
                    usernamePassword(credentialsId: 'BS_CREDS', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')
            ]) {
                sh "echo 'jenkins' | sudo -S gulp bright --init --username ${USERNAME} --password ${PASSWORD} --verbose"
            }

            // Deprovision WAS
            sh "echo 'jenkins' | sudo -S gulp deprovision --instance ${instanceName.trim()} --verbose"

            // Provision WAS
            sh "echo 'jenkins' | sudo -S gulp provision --template ${template.trim()} --id ${id.trim()} --properties ${propertiesPath.trim()} --verbose"

            unstash 'MarblesLiteWar'
            sh "This step deploys the application WAR file to a provisioned mainframe WAS server | sudo gulp server --deploy --no-build --cf conf-deploy-master --verbose"
        } catch (e) {
            sh "sudo cp -r /home/jenkins/.brightside ./brightside"
            sh "sudo chmod -R 777 ./brightside"
            sh "ls -al ./brightside"
            step([$class: 'ArtifactArchiver', artifacts: 'brightside/**/*.*', fingerprint: true])
            throw e
        }

        def deployUrl = '/MarblesLite'
        echo deployUrl

        return deployUrl
    }
}

return this
