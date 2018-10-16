/**
 * script/jenkinsfile/notifyResult.groovy
 *
 * Description: Email build status
 * Input: String buildStatus: build status
 *        String deployUrl: deploy url
 */
def call(String buildStatus = 'STARTED', String deployUrl) {
    // build status of null means successful
    buildStatus =  buildStatus ?: 'SUCCESSFUL'

    // Default values
    def colorName = 'RED'
    def colorCode = '#FF0000'
    def subject = "${buildStatus}: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]'"
    def summary = "${subject} (${env.BUILD_URL})"
    def details = """<p>STARTED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':</p>
    <p>Check console output at "<a href="${RUN_DISPLAY_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>
    <p>Deployed to "<a href="${deployUrl}"> ${deployUrl}</a>"</p>
    """

    // Override default values based on build status
    if (buildStatus == 'STARTED') {
        color = 'YELLOW'
        colorCode = '#FFFF00'
    } else if (buildStatus == 'SUCCESSFUL') {
        color = 'GREEN'
        colorCode = '#00FF00'
    } else {
        color = 'RED'
        colorCode = '#FF0000'
    }

    emailext (
            subject: subject,
            to: "lyzla01@ca.com",
            body: details,
            recipientProviders: [[$class: 'DevelopersRecipientProvider'],
                                 [$class: 'UpstreamComitterRecipientProvider'],
                                 [$class: 'CulpritsRecipientProvider'],
                                 [$class: 'RequesterRecipientProvider']]
    )
}

return this
