// NODE_OPTIONS removes unescaped backslashes inside quotes, including on Windows.
function preloadOption(file){return '--require '+JSON.stringify(file.replaceAll('\\','/'));}
module.exports={preloadOption};

