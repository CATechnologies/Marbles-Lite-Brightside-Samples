/**
 * script/jenkinsfile/unit-test/client.groovy
 *
 * Description: Perform distributed unit test and publish result.
 * Input: String agentLabel: Build agent label
 */

def call(String agentLabel = 'master'){
    node(agentLabel){
        echo 'Start Client Unit Test'
        checkout scm

        dir ('webserver/src/main/client'){
            sh 'npm install'

            try {
                sh 'xvfb-run npm run test-coverage-singlerun'

                // publish unit test report
                publishHTML (target: [
                        allowMissing: false,
                        alwaysLinkToLastBuild: false,
                        keepAll: true,
                        reportDir: 'coverage',
                        reportFiles: 'index.html',
                        reportName: "Client Code Coverage Report"
                ])
            } finally {
                junit 'client-test-results/**/*.xml'
            }
        }
    }
}

return this
