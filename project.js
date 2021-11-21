let minimist = require("minimist");
let fs = require("fs");
let pdf = require("pdf-lib");
let axios = require("axios");
let jsdom = require("jsdom");
let excel4node = require("excel4node");
let path = require("path");
const { match } = require("assert");


let input = minimist(process.argv);

let urlPromise = axios.get(input.url)
urlPromise.then(function (response) {
  fs.writeFileSync(input.folder,response.data,"utf-8");
}).catch(function (error) {
  console.log(error);
  });

fs.readFile(input.folder,"utf-8",function(err,html){
let dom = new jsdom.JSDOM(html);
let matches =[];
let document =dom.window.document;
let allTeams = document.querySelectorAll("div.match-score-block");
for(let i=0;i<allTeams.length;i++){
  let match={
    t1: "",
    t2: "",
    t1s: "",
    t2s: "",
    result: ""
  };

  //matches - teamsName
  let teams = allTeams[i].querySelectorAll("div.name-detail > p.name");
  match.t1= teams[0].textContent;
  match.t2 = teams[1].textContent;

  // teams scores
  let scores = allTeams[i].querySelectorAll("div.score-detail>span.score")
  if(scores.length == 2){
    match.t1s = scores[0].textContent;
    match.t2s = scores[1].textContent;
  }
  else if(scores.length==1){
    match.t1s = scores[0].textContent;
    match.t2s = "";
  }
  else{
    match.t1s = "";
    match.t2s = "";
  }

  // results
  let results = allTeams[i].querySelector("div.status-text>span");
  match.result=results.textContent;
  matches.push(match);
}

  // creating json file
  let file = JSON.stringify(matches);
  fs.writeFileSync("matchFile.json",file,"utf-8",);

// ----------------------------------------------------------------------------------------------------------------------------

  // FOR TEAM.JSON
  // filling the TeamsName without repitition
  let teams =[];
  for(let i=0;i<matches.length;i++){
    fillTeamsName(teams,matches[i].t1);
    fillTeamsName(teams,matches[i].t2);
  }
  // --------------------------------------------------------------------------------------------------------------------------------

  // fill matches in appropriate teams

  for(let i=0;i<matches.length;i++){
    fillAppropriateTeams(teams,matches[i].t1,matches[i].t2,matches[i].t1s,matches[i].t2s,matches[i].result);
    fillAppropriateTeams(teams,matches[i].t2,matches[i].t1,matches[i].t2s,matches[i].t1s,matches[i].result);
  }

  // creating json file
  let teamsJson = JSON.stringify(teams);
  fs.writeFileSync("teams.json",teamsJson,"utf-8");

  excel(teams,input.excel);
  folderAndPdf(teams,input.Teamfolder);

  function fillTeamsName(teams,teamName){
    let idx = -1;
    for(let j=0;j<teams.length;j++){
      if(teams[j].name == teamName){
        idx=j;
      }
    }
    if(idx==-1){
      let team ={
        name :teamName,
        matches : []
      }
      teams.push(team);
      
    }
  }
    // ----------------------------------------------------------------------------------------------------------------------------
  
  function fillAppropriateTeams(teams,homeTeam,oppTeam,homeScore,oppScore,result){
    let idx=-1;
    for(let j=0;j<teams.length;j++){
      if(teams[j].name==homeTeam){
        idx=j;
        break;
      }
    }
  
    let team = teams[idx];
    team.matches.push({
      vs:oppTeam,
      homeScore:homeScore,
      oppScore:oppScore,
      result :result
    })
  }
    // ----------------------------------------------------------------------------------------------------------------------------

  function folderAndPdf(teams,folderName){
    if(fs.existsSync(folderName) == true){
      fs.rmdirSync(folderName, { recursive: true });
  }

  fs.mkdirSync(folderName);
    for(let i=0;i<teams.length;i++){
      let teamPath = path.join(folderName,teams[i].name);
      if(fs.existsSync(teamPath) == false){
        fs.mkdirSync(teamPath);
      }
      for(let j=0;j<teams[i].matches.length;j++){
        let vsMatch = teams[i].matches[j];
        makePdf(teamPath,vsMatch,teams[i].name);
      }
      
    }
  }

  function makePdf(teamPath,vsMatch,homeTeam){
    let filePath = path.join(teamPath,vsMatch.vs);
    let templatePdf = fs.readFileSync("template.pdf");
    let pdfDoc = pdf.PDFDocument.load(templatePdf);
    pdfDoc.then(function(pdfDoc){
    let pages = pdfDoc.getPage(0);
      pages.drawText(homeTeam,{
        x:330,
        y:670,
        size:8
      });
      pages.drawText(vsMatch.vs,{
        x:330,
        y:630,
        size:8
      });
      pages.drawText(vsMatch.homeScore,{
        x:330,
        y:590,
        size:8
      });
      pages.drawText(vsMatch.oppScore,{
        x:330,
        y:560,
        size:8
      });
      pages.drawText(vsMatch.result,{
        x:330,
        y:530,
        size:8
      });

      let pdfBytes = pdfDoc.save();
      pdfBytes.then(function(changedBytes){
        if(fs.existsSync(filePath + ".pdf") == true){
          fs.writeFileSync(filePath + "1.pdf", changedBytes);
      } else {
          fs.writeFileSync(filePath + ".pdf", changedBytes);
      }
  })
    });

  }
  // ----------------------------------------------------------------------------------------------------------------------------

  function excel(teams,fileName){
    let wb = new excel4node.Workbook();
    for(let i=0;i<teams.length;i++){
      let ws = wb.addWorksheet(teams[i].name);
      ws.cell(1, 1).string("vs");
      ws.cell(1, 2).string("homeScore");
      ws.cell(1, 3).string("oppScore");
      ws.cell(1, 4).string("result");
      for(let j=0;j<teams[i].matches.length;j++){
        ws.cell(2+j, 1).string(teams[i].matches[j].vs);
        ws.cell(2+j, 2).string(teams[i].matches[j].homeScore);
        ws.cell(2+j, 3).string(teams[i].matches[j].oppScore);
        ws.cell(2+j, 4).string(teams[i].matches[j].result);
      }
    }

    
    wb.write(fileName);
  }
  
  // ----------------------------------------------------------------------------------------------------------------------------

  
});












// npm i pdf-lib
// npm i axios
// npm i jsdom
// npm i excel4node
// node project.js --url="https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results" --folder="html.txt" --excel="excelFile.csv" --Teamfolder="CricketMatches"