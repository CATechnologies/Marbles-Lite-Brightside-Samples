/**
 * script/jenkinsfile/unit-test/server.groovy
 *
 * Description: Perform distributed unit test for the server code
 * Input: String agentLabel: Build agent label
 */

def call(String agentLabel = 'master') {
    node(agentLabel) {
        echo 'Start Java Unit Test'

        checkout scm
        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        try {
            sh "gulp test --unit --no-run-client"
        } finally {
            junit 'webserver/build/test-results/unit/**/*.xml'
        }
    }
}

return this
