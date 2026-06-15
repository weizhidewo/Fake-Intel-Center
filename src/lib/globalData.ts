let globalData: any = {};

export function setGlobalData(data: any) {
  globalData = data;
}

export function getGlobalData() {
  return globalData;
}
