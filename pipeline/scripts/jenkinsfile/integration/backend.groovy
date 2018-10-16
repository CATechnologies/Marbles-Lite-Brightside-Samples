/**
 * script/jenkinsfile/disMainframeBuild.groovy
 *
 * Description: Perform mainframe build for project.
 * Input: String agentLabel: Build agent label
 */
import org.yaml.snakeyaml.Yaml

def call(String agentLabel = 'master') {
    node(agentLabel){
        echo 'Start mainframe setup process'
        checkout scm

        def initialize = load 'scripts/jenkinsfile/initializeBuildEnvironment.groovy'
        initialize()
        Map<String, Map <String, String>> props = new HashMap<String,Map <String,String>>()
        Yaml parser = new Yaml()
        props = parser.load(("../../gulp.properties.yaml" as File).text)
        def env = System.getenv()
        String user = env['USER']
        String pass = env['PASS']
        // Initialize BrightSide profiles
        echo "Initialize all our brightside profiles"
        sh "echo 'jenkins' | sudo -S gulp bright --init --username ${user} --password ${pass}"

        // Assume the CICS region is already provisioned and just get me the profiles
        echo "Let's get the profile for the provisioned CICS region"
        sh "gulp provision --template ${props.get("provision").get("template")} --id ${props.get("provision").get("instanceID")}"

        // Make sure that we have the MRBC transaction up and running
        echo "Make sure that the transaction and the program are available"
        sh "gulp cobol --define"

        /**
         * This function executes a command and returns stdout
         *
         * IMPLICIT ARGUMENT
         * @param {string} it - Command to execute
         */
        def runCmd = {
            return sh (
                script: "${it}",
                returnStdout: true
            )
        }

        def file = "SystemTestReport.txt"
        def writeLine = {
            def timeStamp = new Date().format("MM/dd/yyyy HH:mm:ss:SSS")
            sh "echo \"${timeStamp} - ${it}\" >> ${file}"
        }

        def outputFile = {
            sh "cat ${file}"
            step([$class: 'ArtifactArchiver', artifacts: file, fingerprint: true])
        }

        /**
         * This function returns information of a marble
         *
         * IMPLICIT ARGUMENT
         * @param {string} it - color of the marble to gather information about
         */
        def getMarbleInfo = {
            return runCmd("bright db2 execute sql --query \"SELECT * FROM EVENT.MARBLE WHERE COLOR IN ('${it}')\" -y")
        }

        /**
         * This function extract a string property from a given object
         *
         * @param {Object} obj  - Specifies the object to search for the following property
         * @param {string} prop - Specifies the property name to look for
         */
        def getStingProp = { obj, prop ->
            prop = "\"${prop}\":"

            if (!obj.contains(prop)) {
                return null
            }

            return obj.substring(
                    obj.indexOf("\"", obj.indexOf(prop) + prop.length() + 1) + 1,
                    obj.indexOf("\"", obj.indexOf(prop) + prop.length() + 2)
            )
        }

        /**
         * This function is specifically designed to run tests for the MRBC transaction
         *
         * @param {string} tParms   - Specifies the Transaction parameters to use while executing the MRBC CICS transaction
         * @param {string} expected - Specifies the expected output of the command
         * @param {string} success  - Specifies the success message
         * @param {string} failure  - Specifies the failure message
         * @throws {Exception} Indicating that the test failed
         */
        def runTestMrbc = { tParms, expected, success, failure ->
            writeLine("Executing command: MRBC ${tParms}")

            // Use Modify to issue CICS commands
//            def output = runCmd("bright cics issue modify \"MRBC ${tParms}\"")
            def output = runCmd("bright cics issue modify \"${props.get("cobol").get("trans")} ${tParms}\"")

            /*
            // Use 3bt to run CICS commands
            def output = runCmd("bright cics run 3bt MRBC --tp \"${tParms}\" " +
                    "--qm Q231 --rq Q231.DEFXMIT.QUEUE --bq SYSTEM.CICS.BRIDGE.QUEUE --cn SYSTEM.DEF.SVRCONN --mp 7231")
            */

            if (output.contains(expected)) {
                writeLine("Command ran as expected")
            } else {
                writeLine("${failure}")
                writeLine("Output:")
                writeLine(output)
                outputFile()
                throw new Exception("${failure}\nOutput:\n${output}")
            }

            def parms = tParms.tokenize(' ')
            def isSuccessful

            // Check that the command actually did what it was supposed to
            if (parms[0] == "DEL") {
                isSuccessful = getStingProp(getMarbleInfo(parms[1]), "INVENTORY") == null
            } else {
                isSuccessful = getStingProp(getMarbleInfo(parms[1]), "INVENTORY") == parms[-1]
            }

            if (isSuccessful) {
                writeLine("${success}")
            } else {
                def errMsg = "The DB2 table was not altered!"
                writeLine("${failure}")
                writeLine("Output:")
                writeLine(errMsg)
                outputFile()
                throw new Exception("${failure}\nOutput:\n${errMsg}")
            }
        }


        def marbleColor = "BLACK"
        def marbleState = ""
        def shouldAddCost = false
        def testValue = "3"
        def expectedSuccess = "SUCCESS"

        // TODO: Open report file for output
        // TODO: Change every echo statement to write-file
        // TODO: Write each test result to the file
        // TODO: archive the file
        // TODO: Output the file as the last step

        // Create file for reporting purposes

        writeLine("Check if a ${marbleColor} marble exists")
        def marbleStateCheck = getMarbleInfo(marbleColor)

        // Save status of the <marbleColor> marble; DELETE it
        if (marbleStateCheck.contains("INVENTORY")) {
            writeLine("${marbleColor} exists. Saving state of the marble to restore it later.")
            marbleState = getStingProp(marbleStateCheck, "INVENTORY")

            if (marbleStateCheck.contains("COST")) {
                shouldAddCost = true
                marbleState = "${marbleState} " + getStingProp(marbleStateCheck, "COST")
            }

            // Delete the <marbleColor> marble
            runCmd("bright db2 execute sql --query \"DELETE FROM EVENT.MARBLE WHERE COLOR='${marbleColor}'\"")
        }

        if (marbleState) {
            writeLine("MARBLE, (INVENTORY${shouldAddCost? " COST" : ""}): ${marbleColor}, (${marbleState}) was saved and removed from the table")
        } else {
            writeLine("${marbleColor} marble does not exists")
        }

        // Add <marbleColor> Marble
        runTestMrbc(
            shouldAddCost ? "CRE ${marbleColor} ${testValue} ${testValue}" : "CRE ${marbleColor} ${testValue}",
            "${expectedSuccess}",
            "We successfully added a ${marbleColor} marble!",
            "We failed to add a ${marbleColor} marble!"
        )

        // Update <marbleColor> Marble
        testValue = "1"
        runTestMrbc(
            shouldAddCost ? "UPD ${marbleColor} ${testValue} ${testValue}" : "UPD ${marbleColor} ${testValue}",
            "${expectedSuccess}",
            "We successfully updated a ${marbleColor} marble!",
            "We failed to update a ${marbleColor} marble!"
        )

        // Delete <marbleColor> Marble
        runTestMrbc(
            "DEL ${marbleColor}",
            "${expectedSuccess}",
            "We successfully deleted a ${marbleColor} marble!",
            "We failed to delete a ${marbleColor} marble!"
        )

        // Restore status of <marbleColor> marble
        if (marbleState) {
            runTestMrbc(
                "CRE ${marbleColor} ${marbleState}",
                "${expectedSuccess}",
                "${marbleColor} marble successfully restored",
                "${marbleColor} marble was lost in the process"
            )
        }

        outputFile()
    }
}

return this
