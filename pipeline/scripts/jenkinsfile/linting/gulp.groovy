/**
 * scripts/jenkinsfile/linting/gulp.groovy
 *
 * Description: Perform gulp linting for project
 * Input: String agentLabel: Build agent label
 */
def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'start gulp linting'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        sh 'gulp lint --gulp'
    }
}

return this
