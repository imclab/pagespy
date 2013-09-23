/**
 * CDN patterns.
 */

module.exports = {
    Akamai: [
        /(?:edge(?:suite|key)|akamai(?:edge|hd)?|srip)\.net$/i
      , /akamaitechnologies\.com$/i
      , /akadns\.net$/i
    ]
  , Turbobytes: [
        /turbobytes\.com$/i
    ]
  , Edgecast: [
        /edgecastcdn\.net$/i
    ]
  , CloudFront: [
        /cloudfront\.net$/i
    ]
  , CDNetworks: [
        /cdngc\.net$/i
    ]
  , CacheFly: [
        /cachefly\./
    ]
  , CloudFare: [
        /cloudfare\.net$/i
    ]
  , CDN77: [
        /cdn77\.net$/i
    ]
  , Fastly: [
        /fastly\.net/i
    ]
  , Level3: [
        /footprint\.net$/i
    ]
  , NetDNA: [
        /netdna-(?:cdn|ssl)\.com$/i
    ]
  , BitGravity: [
        /bitgravity\.com$/i
    ]
  , Internap: [
        /internapcdn\.net$/i
    ]
  , CoralCDN: [
        /nyud\.net$/i
    ]
};

