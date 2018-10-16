/**
 * script/jenkinsfile/disClientBuild.groovy
 *
 * Description: Perform distributed build for project and archive war file.
 * Input: String agentLabel: Build agent label
 */

def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'Start build client process'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize(false)

        // Build the server using the gulp task
        sh "This step builds Marbles Lite WAR file | gulp server --build"

        // archiving war files
        step([$class: 'ArtifactArchiver', artifacts: '**/libs/*.war', fingerprint: true])
        step([$class: 'ArtifactArchiver', artifacts: '**/resources/conf-deploy.yaml', fingerprint: true])

        stash includes: '**/libs/*.war', name: 'MarblesLiteWar'
    }
}

return this
