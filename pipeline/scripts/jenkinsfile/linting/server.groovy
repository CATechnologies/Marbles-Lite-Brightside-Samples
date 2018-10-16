/**
 * scripts/jenkinsfile/linting/server.groovy
 *
 * Description: Perform gulp linting for the Java code
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'start server linting'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        sh 'gulp lint --server'
    }
}

return this
