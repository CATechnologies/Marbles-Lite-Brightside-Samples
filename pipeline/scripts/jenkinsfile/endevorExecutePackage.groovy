/**
 * script/jenkinsfile/endevorExecutePackage.groovy
 *
 * Description: execute Endevor Package.
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master') {
    node(agentLabel) {
        echo 'start Endevor execute'
        checkout scm

        echo 'build Environment'
        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize()

    try {
          // Build the server using the gulp task
          // Initialize BrightSide profiles
          echo 'init bright'
        withCredentials([
                usernamePassword(credentialsId: 'BS_CREDS', usernameVariable: 'USERNAME', passwordVariable: 'PASSWORD')
        ]) {
            sh "gulp bright --init --username ${USERNAME} --password ${PASSWORD} --verbose"
            sh "echo 'jenkins' | sudo -S gulp bright --init --username ${USERNAME} --password ${PASSWORD} --verbose"
        }

          // Execute Endevor package
          echo 'execute Endevor package'
          sh "echo 'jenkins' | sudo -S gulp endevor --executePackage --verbose"


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
