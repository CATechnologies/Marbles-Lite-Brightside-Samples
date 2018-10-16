/**
 * script/jenkinsfile/disClientDeploy.groovy
 *
 * Description: Deploy product to designated host.
 * Input: String agentLabel: Build agent label
 *        String hostUrl: jenkins master host url
 */

def call(String agentLabel, String hostUrl) {
    node(agentLabel){
        echo 'start client deployment'

        unarchive mapping: ['webserver/build/libs/MarblesLite.war': 'MarblesLite.war']
        unarchive mapping: ['webserver/src/main/resources/conf-deploy.yaml': 'conf-deploy.yaml']

        sh "chmod 777 MarblesLite.war conf-deploy.yaml"
        sh "ls -l"

        // copy config file
        sh "sudo [ -f /config/resources/config/MarblesLite.yaml ] && sudo rm /config/resources/config/MarblesLite.yaml || echo 'file not exist' "
        sh "sudo cp conf-deploy.yaml /config/resources/config/MarblesLite.yaml"
        sh "sudo cat /config/resources/config/MarblesLite.yaml"
        
        // copy war file
        sh "sudo [ -f /config/dropins/MarblesLite.war ] && sudo rm /config/dropins/MarblesLite.war || echo 'file not exist' "
        sh "sudo cp MarblesLite.war /config/dropins/MarblesLite.war"
        sh "sudo ls -l /config/dropins"

        // Restart running server
        sh "sudo /opt/ibm/wlp/bin/server stop"
        sh "sudo /opt/ibm/wlp/bin/server start"
        cleanWs()

        def deployUrl = hostUrl + ':' + DEPLOY_PORT + '/MarblesLite'
        echo deployUrl

        return deployUrl
    }
}

return this
