import * as chai from "chai";
import { } from "mocha";
import * as config from "config";
import { Session, SubmitJobs, GetJobs, IJobFile } from "brightside";
import * as child_process from "child_process";

// credentials for system - these could come from jenkins / urban code properties
const session = new Session({
  user: config.get<string>("credentials.user"),
  password: config.get<string>("credentials.password"),
  hostname: config.get<string>("system.host"),
  port: config.get<string>("system.port"),
  rejectUnauthorized: false,
  type: "token",
  tokenType: "LptaToken2"
});

// globals
let gold: string;
let content: string;

describe("sample suite of job tests", () => {

  /**
   * test setup
   */
  before(async () => {

    // modify jcl 
    const printCommand = "bright files print data-set \"" + config.get<string>("test.jcl") + "\"";
    let jcl = child_process.execSync(printCommand).toString(); //get jcl content
    jcl = jcl.replace(/IZUACCT/g, config.get<string>("credentials.account")); // replace input
    jcl = jcl.replace(/INPUT=.\S*/g, "INPUT='" + config.get<string>("test.input") + "'"); // replace input

    // submit job
    const job = await SubmitJobs.submitJclNotify(session, jcl); // *API* submit JCL

    // get job output DD
    const spools = await GetJobs.getJobSpoolFiles(session, job.jobname, job.jobid); // *API* get all spool files
    const spool = spools.find((element) => element.ddname === "STDOUTL"); // get "STDOUTL" spool file
    content = await GetJobs.getSpoolContent(session, spool as IJobFile);  // *API* obtain the spool raw-content

    // get "gold" standard output
    const goldPrintCommand = "bright files print data-set \"" + config.get<string>("test.gold") + "\"";
    gold = child_process.execSync(goldPrintCommand).toString(); // get file from z/OS
  });

  /**
   * Specific tests
   */

  // compare full "gold" to our test output
  it("should match expected output", async () => {
    chai.expect(content).to.not.be.undefined; // verify defined
    chai.expect(content).to.eql(gold); // verify match
  });

  // verify our expected colors
  it("should have positive inventory of marbles", () => {
    const inventoryColorIndex = 0;
    const rows: string[] = content.split("\n"); // get rows
    rows.shift() // minus table headings
    chai.expect(rows[0][inventoryColorIndex]).to.be("RED");
    chai.expect(rows[1][inventoryColorIndex]).to.be("BLUE");
  });

  // verify proper marble inventory
  it("should have positive inventory of marbles", () => {
    const inventoryColumnIndex = 1;
    const rows: string[] = content.split("\n"); // get rows
    rows.shift() // minus table headings
    rows.forEach( (row) => {
      chai.expect(row[inventoryColumnIndex]).to.be.greaterThan(0);
    });
  });

  // verify proper marble inventory
  it("should have positive inventory of marbles", () => {
    const inventoryCostIndex = 2;
    const rows: string[] = content.split("\n"); // get rows
    rows.shift() // minus table headings
    rows.forEach((row) => {
      chai.expect(row[inventoryCostIndex]).to.be.greaterThan(0);
    });
  });

});
