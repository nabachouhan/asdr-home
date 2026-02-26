const config = {

    // 🔒 Optional: whitelist known Themes/db (recommended)
     whitelistTheme : ['administrative','weatherclimate', 'landresource', 'waterresource', 'disastermanagement', 'infrastructure', 'utility', 'terrain'],

    databasesToCreate : [
  'administrative',
  'utility',
  'terrain',
  'landresource',
  'waterresource',
  'weatherclimate',
  'disastermanagement',
  'infrastructure',
  'commonshapefiles'
],

};

export default config;
