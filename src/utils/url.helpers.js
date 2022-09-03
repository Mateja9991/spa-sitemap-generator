const protocolRegexp = new RegExp("^(http|https)://");
const wwwRegexp = new RegExp("^((http|https)://)?(www.)?");
const removeProtocol = (url) => url.replace(protocolRegexp, "");
const shrinkDomain = (url) => url.replace(wwwRegexp, "");
const setBase = (path, { origin }) => new URL(path, origin).href;
const rebasePaths = (paths, baseUrl) =>
  paths.map(({ path, ...rest }) => ({
    url: baseUrl ? setBase(path, new URL(baseUrl)) : url,
    ...rest,
  }));
module.exports = { setBase, rebasePaths, removeProtocol, shrinkDomain };
