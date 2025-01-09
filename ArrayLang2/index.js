"use strict"
codetext.addEventListener('keydown', function(e) {
	if (e.key == 'Tab') {
	  e.preventDefault();
	  var start = this.selectionStart;
	  var end = this.selectionEnd;
  
	  // set textarea value to: text before caret + tab + text after caret
	  this.value = this.value.substring(0, start) +
		"\t" + this.value.substring(end);
  
	  // put caret at right position again
	  this.selectionStart =
		this.selectionEnd = start + 1;
	}
  });

function debugstringpos(string,pos){
	return string+"\n"+" ".repeat(pos)+"^";
}

function replaceAll(str,mapObj){
	var re = new RegExp(Object.keys(mapObj).join("|"),"gi");
	return str.replace(re, function(matched){
		return mapObj[matched.toLowerCase()];
	});
}

/**The plan: A scripting language like this:
 * 
 * 	global a[4]
 * 	#this is a comment
 * 	a[0]=1
 * 	if a[1]%2: #this is also a comment, too
 * 		a[1]=a[1]/2
 * 		a[3]=42
 * 	else:
 * 		a[1]=3*a[1]-1
 * 
 * Convert it to something like this:
 * [1,a[1]=1?1:a[1],{1:2,2:3,3:1}[a[2]],a[1]=1?42:a[3]]
 * 
 * g[1] = rand() //rand() -> rand() -> (rand())
 * g[1] = g[1]+5 //g[1]+5 -> (rand())+5 -> ((rand())+5)
 * g[1] = g[1]*2 //g[1]*2 -> ((rand())+5)*2 -> (((rand())+5)*2)
*/
/**[a[0],a[1],a[2]]
 * a[0]=a[1]+2
 * [a[1]+2,a[1],a[2]]
 * a[1]=5
 * [a[1]+2,5,a[2]]
*/
/**[a[0],a[1],a[2]]
 * a[1]=5
 * [a[0],5,a[2]]
 * a[0]=a[1]+2
 * [5+2,5,a[2]]
*/

console.log("Test!")

function test1(){
	codetext.value = 
`global abcxyz[3]
abcxyz[1]=abcxyz[1]+3
abcxyz[2]=abcxyz[0]+abcxyz[1]+abcxyz[2]
#[a[0],a[1]+3,a[0]+a[1]+a[2]]
abcxyz[0]=abcxyz[1]*4
#number 0 is replaced with abcxyz[1]*4, in which abcxyz[1] gets replaced with (abcxyz[1]+3), making it (abcxyz[1]+3)*4
#In order words, abcxyz[1] is instance to be substituted, abcxyz[1]*4 is the value to look for such instances, and abcxyz[1]+3 is the substituent
#[(abcxyz[1]+3)*4,abcxyz[1]+3,abcxyz[0]+abcxyz[1]+abcxyz[2]]`
}

function test2(){
	codetext.value = 
`global a[4]
a[2]=a[0]+a[1]+a[2]
a[1]=a[1]+3
#[a[0],a[1]+3,a[0]+a[1]+a[2],a[3]]
if a[1]>2:
	a[1]=a[1]-1
else:
	a[2]=a[2]/2
#condition: a[1]>2
#[a[0],a[1]-1,a[2],a[3]]
#[a[0],a[1],a[2]/2,a[3]]
#since only a[1] and a[2] gets modified, they get the if treatment.
#condition is a[1]>2, which gets substituted with a[1]+3, making it (a[1]+3)>2
#[a[0],(a[1]+3)>2?(a[1]+3)-1:a[1]+3,(a[1]+3)>2?a[0]+a[1]+a[2]:(a[0]+a[1]+a[2])/2,a[3]]`;
}

/**
 * 
 * @param {string} str 
 */
function parseline(str){
	return 0;
}

/**
 * 
 * @param {string[]} lines 
 * @param {number} indentlvl 
 */
function parseindent(lines, linestart, indentlvl){
	var indentstr = "\t".repeat(indentlvl)
	//Initialize
	var variables = [];
	for(let i = 0;i<varelemcount;i++){
		variables.push([varname,"[",i,"]"].join(""));
	}
	//
	console.log("{"+variables.join(", ")+"]");; //For debugging purposes
	var a = lines[0]
}

class Statement{
	/** @type {null | true | false} */
	condition = null;
	/** @type {string} */
	variable = "";
	/** @type {string} */
	targetvar = "";
}

class Condition{
	/** @type {string} */
	condition = "";
	/** @type {Statement[]} */
	statements = [];
}

function run(){
	//Replace all the \n into spaces and removes beginning and trailing whitespace between ;
	//Kinda like trim(), but whatever.
	/** @type {string?} */
	var sourcecode = codetext.value;
	if(!sourcecode){
		return;
	}
	sourcecode = sourcecode.replaceAll(/#.*/ig,""); //Removes comments with #
	sourcecode = sourcecode.replaceAll("\r\n","\n"); //Replaces newline and tabs to space
	//sourcecode = sourcecode.replaceAll(/(\s+\;)|(\;\s+)/ig,";"); //Removes all whitespace infront or behind the semicolon
	//sourcecode = sourcecode.replaceAll(/(\s+\{)|(\{\s+)/ig,"{"); //Removes all whitespace infront or behind the open curly bracket
	//sourcecode = sourcecode.replaceAll(/(\s+\})|(\}\s+)/ig,"}"); //Removes all whitespace infront or behind the close curly bracket
	var statements = sourcecode.split("\n");
	//statements = statements.filter((stmt)=>stmt.length>0); //Don't remove lines, we need them to keep track of errors at certain lines
	statements = statements.map((stmt)=>stmt.trimEnd());
	console.log(sourcecode); //For debugging purposes
	//Get the first statement!
	if(!statements[0].startsWith("global ")){
		throw "ERROR: Code must start with \"global\"";
	}
	//Parse the first statement to get the variable name and element count
	var varcode = statements[0].split(" ",2)[1]
	var varname = varcode.split("[",1)[0]
	var varelemcount = parseInt(varcode.split("[",2)[1].split("]",1)[0])
	if(isNaN(varelemcount)||varelemcount<=0||varelemcount>Number.MAX_SAFE_INTEGER){
		throw "ERROR: element count is invalid";
	}
	//Initialize variable transformations based from the variable name and element count
	/**
	 * @param {string} name 
	 * @param {number} elemcount 
	 * @returns {string[]}
	 */
	function createvar(name,elemcount){
		return Array.from({length: elemcount}, (_v,i) => `${name}[${i}]`);
	}
	/** @type {string[]} */
	var varb = createvar(varname,varelemcount);
	//Generate variables
	
	/* for(let i = 0;i<varelemcount;i++){
		varb.push([varname,"[",i,"]"].join(""));
	} */
	console.log(varb);
	//Execute order si- I mean, execute the statements!
	console.log(statements);
	//
	/** @type {[string,string[],string[]|null][]} */
	var varstack = [];
	/** @type {string[]?} */
	var curvar = null; 
	var curindentlvl = 0;
	var indentmatcher = /^\t*/;
	/**@param {string} variable */
	var varmatcher = new RegExp(varname+"\\[(\\d+)\\]","gi");
	// var varmatcher = /\[(\d+)\]/g
	for(let line = 0; line < statements.length + 1; line++){
		var stmt = line < statements.length ? statements[line] : "";
		var tabs = indentmatcher.exec(stmt)[0];
		indentmatcher.lastIndex = 0;  //Reset the regex state before reusing on other strings
		var indentlvl = tabs.length;
		stmt = stmt.slice(indentlvl)
		if(indentlvl > curindentlvl){
			//Unexpected indentation!
			throw `ERROR: unexpected indentation at line ${line+1}`;
		}
		while(indentlvl < curindentlvl){
			curindentlvl--; //It'll be reincremented again when we find else statement
			if(indentlvl == curindentlvl && stmt.startsWith("else")){
				//Don't pop the stack! We need the item in the current level of the stack
				break;
			}
			//else, pop the stack
			var poppedvarstack = varstack.pop()
			/*
			 *	a[2]=a[0]+a[1]+a[2]
			 *	a[1]=a[1]+3
			 *	#[a[0],a[1]+3,a[0]+a[1]+a[2]]
			 *	if a[1]>2:
			 *		a[1]=a[1]-1
			 *	else:
			 *		a[2]=a[2]/2
			 *	#condition: a[1]>2
			 *	#[a[0],a[1]-1,a[2]]
			 *	#[a[0],a[1],a[2]/2]
			 *	#since only a[1] and a[2] gets modified, they get the if treatment.
			 *	#condition is a[1]>2, which gets substituted with a[1]+3, making it (a[1]+3)>2
			 *	
			 *	#[a[0],(a[1]+3)>2?(a[1]+3)-1:a[1]+3,(a[1]+3)>2?a[0]+a[1]+a[2]:(a[0]+a[1]+a[2])/2]
			 */
			curvar = varb;
			if(curindentlvl>0){
				curvar = varstack[curindentlvl-1][2] == null ? varstack[curindentlvl-1][1]:varstack[curindentlvl-1][2];
			}
			var curvarcopy = Array.from(curvar);
			var condition = poppedvarstack[0];
			var values1 = poppedvarstack[1];
			var values2 = poppedvarstack[2];
			var conditionsubbed = condition.replace(varmatcher,
				function(match,as_idx){
					let substituent = curvar[as_idx]
					console.log("Instances of",match,"in",condition,"will be substituted with",substituent)
					//No need parentheses if substituent is same as match
					return match == substituent ? match : `(${substituent})`;
				}
			)
			if(values2 == null){
				//Go with if
				var valuemask = Array.from({length: varelemcount}, (_v,i) => `${varname}[${i}]` != values1[i]);
				console.log("Value mask",valuemask);
				for(let i = 0;i<varelemcount;i++){
					if(!valuemask[i]){
						continue;
					}
					var value1 = values1[i];
					var valuesubbed1 = value1.replace(varmatcher,
						function(match,as_idx){
							let substituent = curvar[as_idx]
							console.log("Instances of",match,"in",value1,"will be substituted with",substituent)
							//No need parentheses if substituent is same as match
							return match == substituent ? match : `(${substituent})`;
						}
					)
					var valuesubbed2 = curvar[i];
					console.log(valuesubbed1,valuesubbed2)
					console.log(`${conditionsubbed}?${valuesubbed1}:${valuesubbed2}`)
					curvarcopy[i] = `(${conditionsubbed}?${valuesubbed1}:${valuesubbed2})`
				}
			}
			else{
				//Go with if-else
				var valuemask = Array.from({length: varelemcount}, (_v,i) => `${varname}[${i}]` != values1[i] || `${varname}[${i}]` != values2[i]);
				console.log("Value mask",valuemask)
				for(let i = 0;i<varelemcount;i++){
					if(!valuemask[i]){
						continue;
					}
					var value1 = values1[i];
					var valuesubbed1 = value1.replace(varmatcher,
						function(match,as_idx){
							let substituent = curvar[as_idx]
							console.log("Instances of",match,"in",value1,"will be substituted with",substituent)
							//No need parentheses if substituent is same as match
							return match == substituent ? match : `(${substituent})`;
						}
					)
					var value2 = values2[i];
					var valuesubbed2 = value2.replace(varmatcher,
						function(match,as_idx){
							let substituent = curvar[as_idx]
							console.log("Instances of",match,"in",value2,"will be substituted with",substituent)
							//No need parentheses if substituent is same as match
							return match == substituent ? match : `(${substituent})`;
						}
					)
					console.log(valuesubbed1,valuesubbed2)
					console.log(`${conditionsubbed}?${valuesubbed1}:${valuesubbed2}`)
					curvarcopy[i] = `(${conditionsubbed}?${valuesubbed1}:${valuesubbed2})`
				}
			}
			for(let i = 0;i<varelemcount;i++){
				curvar[i] = curvarcopy[i]; //Copy values back to the original variable
			}
		}
		//Begin parsing statements here
		if(indentlvl>0){
			curvar = varstack[indentlvl-1][2] == null ? varstack[indentlvl-1][1]:varstack[indentlvl-1][2];
		}
		else{
			curvar = varb
		}
		if(stmt.startsWith("if ")){
			//
			
			if(curindentlvl!=varstack.length){
				throw `ERROR: unexpected if statement at line ${line+1}`
			}
			var condition = stmt.split(" ",2)[1].split(":",1)[0]
			varstack.push([condition,createvar(varname,varelemcount),null])
			curindentlvl++;
		}
		else if(stmt.startsWith("else")){
			//
			if(varstack[varstack.length-1][2] != null){
				throw "Encountered multiple else statements?"
			}
			varstack[varstack.length-1][2] = createvar(varname,varelemcount);
			curindentlvl++;
		}
		else{
			//assignment operator
			var assignopindex = stmt.indexOf("=");
			if(assignopindex == -1){
				continue;
			}
			varmatcher.lastIndex = 0;
			var assignee = stmt.slice(0,assignopindex).trim();
			var value = stmt.slice(assignopindex+1).trim();
			var assigneeindex = parseInt(varmatcher.exec(assignee)[1])
			if(assignopindex == null){
				throw `ERROR: invalid assignee at line ${line+1}`;
			}
			varmatcher.lastIndex = 0; //Reset the regex state before reusing on other strings
			/* [a[0],a[1]+3,a[0]+a[1]+a[2]]
			 * a[0]=a[1]*4
			 * number 0 is replaced with a[1]*4, in which a[1] gets replaced with (a[1]+3), making it (a[1]+3)*4
			 * [(a[1]+3)*4,a[1]+3,a[0]+a[1]+a[2]]
			**/
			console.log("Current variables",curvar);
			console.log("Set variable in index",assigneeindex,"with",value);
			//Variable substitution happens here
			var valuesubbed = value.replace(varmatcher,
				function(match,as_idx){
					let substituent = curvar[as_idx]
					console.log("Instances of",match,"in",value,"will be substituted with",substituent)
					//No need parentheses if substituent is same as match
					return match == substituent ? match : `(${substituent})`;
				}
			)
			//Assignment happens here
			curvar[assigneeindex] = valuesubbed //Since only one variable is changed, we can directly modify the curvar
			//Test
			console.log("Current variables (after)",curvar);
		}
	}
	/* var instructions = parsecode(sourcecode);
	console.log("before simplification",instructions);
	//let statements = simplifyinstructions(instructions);
	console.log("after simplification",statements);
	var output = "["+variables.join(", ")+"]";
	if(Object.keys(statements).length>0){
		output = output.replace(new RegExp(Object.keys(statements).map(key=>key.replace(/[-\/\\^$*+?.()|[\]{}]/g,"\\$&")).join("|"),"gi"),(m)=>statements[m])
	}
	result.value = output; */
	result.value = `[${curvar}]`;
}