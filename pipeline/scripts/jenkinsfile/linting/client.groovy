/**
 * scripts/jenkinsfile/linting/client.groovy
 *
 * Description: Perform gulp linting for the client code
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'start client linting'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        dir ('webserver/src/main/client') {
            sh 'npm install'
        }

        sh 'gulp lint --client'
    }
}

return this
