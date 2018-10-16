/**
 * script/jenkinsfile/endevorPackaging.groovy
 *
 * Description: Define and cast Endevor Package.
 * Input: String agentLabel: Build agent label
 */

// ***********************************************************************************
// NOT CURRENTLY USED AS THE EMAIL WORK HAS BEEN RE-ENABLED IN endevorPackaging.groovy
// ***********************************************************************************

def call(String agentLabel = 'master', String toEmailAddress) {
    // Send email to have the package approved
    echo 'Send email for package approval'
    def details = """MarblesLite Endevor Package approval required. <p>STARTED: Job '${env.JOB_NAME} [${env.BUILD_NUMBER}]':</p>
    <p>To approve or decline follow the link: "<a href="${RUN_DISPLAY_URL}">${env.JOB_NAME} [${env.BUILD_NUMBER}]</a>"</p>
    """
    emailext (
            subject: "Package approval required",
            to: toEmailAddress,
            body: details,
            recipientProviders: [[$class: 'DevelopersRecipientProvider'],
                                 [$class: 'UpstreamComitterRecipientProvider'],
                                 [$class: 'CulpritsRecipientProvider'],
                                 [$class: 'RequesterRecipientProvider']]
    )

}

return this
