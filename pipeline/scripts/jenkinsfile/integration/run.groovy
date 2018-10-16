/**
 * script/jenkinsfile/integration/run.groovy
 *
 * Description: Perform integration testing
 * Input: String agentLabel: Build agent label
 *        String testUrl:    The url of a system where WAS is started on
 */

def call(String agentLabel = 'master', String testUrl){
    node(agentLabel){
        echo 'Start Integration Test'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        // Initialize only the cucumber environment
        sh 'gulp init --only --cucumber'

        // Create the config file
        dir ('scripts/jenkinsfile/integration'){
            sh 'node ./createConfig.js --url "' + testUrl + '" --width 1920 --height 1080'
        }

        try {
            // Create a 1920x1080 virtual monitor and run the gulp test task on said monitor
            sh 'xvfb-run -s "-screen 0 1920x1080x24" gulp test --integration --no-launch-report --junit-report'
        } finally {
            step([$class: 'ArtifactArchiver', artifacts: 'webserver/build/reports/cucumber/screenshots/**/*.png', allowEmptyArchive: true, fingerprint: true])
            junit 'webserver/build/reports/cucumber/**/*.xml'

            // publish integration test report
            publishHTML (target: [
                    allowMissing: false,
                    alwaysLinkToLastBuild: false,
                    keepAll: true,
                    reportDir: 'webserver/build/reports/cucumber',
                    reportFiles: 'report.html',
                    reportName: "Cucumber Test Report"
            ])

            // The thing below is too unreliable
//            cucumber fileIncludePattern: '**/*.json', jsonReportDirectory: 'webserver/build/reports/cucumber/', sortingMethod: 'ALPHABETICAL'
        }
    }
}

return this
