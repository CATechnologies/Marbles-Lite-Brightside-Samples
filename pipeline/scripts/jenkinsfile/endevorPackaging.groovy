/**
 * script/jenkinsfile/endevorPackaging.groovy
 *
 * Description: Define and cast Endevor Package.
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master', String toEmailAddress) {
    node(agentLabel) {
        echo 'start Endevor packaging'
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


          // Execute Endevor packaging
          echo 'execute Endevor packaging'
          sh "echo 'jenkins' | sudo -S gulp endevor --designCastPackage --verbose"

          // Send email to have the package approved
          echo 'send email for package approval'
          def details = """MarblesLite Endevor Package approval required. <p>STARTED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':</p>
          <p>To approve or decline follow the link: "<a href="${RUN_DISPLAY_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>
          """
          emailext (
            subject: "Package approval required",
            to: toEmailAddress,
            body: details
//            recipientProviders: [[$class: 'DevelopersRecipientProvider'],
//                                 [$class: 'UpstreamComitterRecipientProvider'],
//                                 [$class: 'CulpritsRecipientProvider'],
//                                 [$class: 'RequesterRecipientProvider']]
          )
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
