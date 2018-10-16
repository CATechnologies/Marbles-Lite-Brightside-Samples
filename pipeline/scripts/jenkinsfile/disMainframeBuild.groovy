/**
 * script/jenkinsfile/disMainframeBuild.groovy
 *
 * Description: Perform mainframe build for project.
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'Start mainframe setup process'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize()

        try {
            sh "echo 'jenkins' | gnome-keyring-daemon --unlock"

            withCredentials([
                    usernamePassword(credentialsId: 'BS_CREDS', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')
            ]) {
                sh "gulp bright --init --username ${USERNAME} --password ${PASSWORD} --verbose"
            }

            // Build the server using the gulp task
            // Initialize BrightSide profiles

            // Create endevor project to be able to use gulp cobol task
            sh "gulp endevor --createProj --verbose"

            // Configure cobol CICS transaction
            sh "This step builds the Marbles Cobol program and deploys to CICS | gulp cobol --verbose"

        } catch (e) {
            sh "sudo cp -r /home/jenkins/.brightside ./brightside"
            sh "sudo chmod -R 777 ./brightside"
            sh "ls -al ./brightside"
            step([$class: 'ArtifactArchiver', artifacts: 'brightside/**/*.*', fingerprint: true])
            throw e
        }
    }
}

return this
