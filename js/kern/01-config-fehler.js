window.addEventListener("error",function(e){if(/config\.js/.test(e.filename||""))window.FALLPFAD_CONFIG_ERROR=String(e.message||"Syntaxfehler");});
