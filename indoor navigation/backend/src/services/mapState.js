let activeMap = null;

function setActiveMap(mapPayload) {
  activeMap = mapPayload;
}

function getActiveMap() {
  return activeMap;
}

module.exports = {
  setActiveMap,
  getActiveMap,
};
