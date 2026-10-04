(() => {
  const SCRIPT_ID = "aegis-brain-command-script";

  if (document.getElementById(SCRIPT_ID)) return;

  const script = document.createElement("script");
  script.id = SCRIPT_ID;
  script.src = "/static/brain-command.js?v=1";
  document.body.appendChild(script);

  console.log("AEGIS SECURITY BRAIN COMMAND LOADED");
})();
