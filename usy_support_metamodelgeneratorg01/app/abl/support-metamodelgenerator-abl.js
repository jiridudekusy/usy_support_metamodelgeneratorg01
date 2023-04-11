"use strict";
const fs = require("fs");
const path = require("path");
const IGNORED_PROFILES = ["AwidOwner", "Public", "AwidLicenseOwner"];
const FILE_READ_OPTIONS = {encoding: "utf8", flag: "r"}

class SupportMetamodelgeneratorAbl {

  async createMetaModel(dtoIn) {
    const profiles = JSON.parse(fs.readFileSync(dtoIn.profilesFile, FILE_READ_OPTIONS));
    let existingMetamodel;
    if (fs.existsSync(dtoIn.metamodel)) {
      existingMetamodel = JSON.parse(fs.readFileSync(dtoIn.metamodel, FILE_READ_OPTIONS));
    }

    let res;
    if (existingMetamodel && (existingMetamodel.schemaVersion.startsWith("1") || existingMetamodel.schemaVersion.startsWith("0"))) {
      res = this.createMetaModelV1(existingMetamodel, profiles, dtoIn.mandatoryProfiles);
    } else {
      res = this.createMetaModelV2(existingMetamodel, profiles, dtoIn.mandatoryProfiles);
    }

    fs.writeFileSync(dtoIn.metamodel, JSON.stringify(res, null, 2))
  }
  createMetaModelV1(existingMetamodel, profiles, mandatoryProfiles) {
    const template = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../", "resources/template-1.0.json"), FILE_READ_OPTIONS));
    let res = template;
    if (existingMetamodel) {
      this._fillHeader(res, existingMetamodel);
    }

    let profileList = profiles["*"].profileList;
    profileList = profileList.filter(p => !IGNORED_PROFILES.includes(p));
    if (existingMetamodel) {
      if (!this._checkArrayEquals(profileList, existingMetamodel.profileList.map(p => p.code))) {
        console.log("Profiles are not same !!!");
        console.log(`profiles.json : ${profileList.join(", ")}`)
        console.log(`metamodel.json: ${existingMetamodel.profileList.map(p => p.code).join(", ")}`)
        return;
      }
    }
    let profilesUcMap = profiles["*"].useCaseMap;

    if (mandatoryProfiles.some(i => !(profileList.indexOf(i) > -1))) {
      throw "Missing mandatory profile. You must have at least these 3 profiles in your profiles.json : Authorities, Executives, Auditors. If you have these profiles with different name, please use --mandatory-profiles attribute to map it.";
    }

    if (existingMetamodel) {
      res.profileList = existingMetamodel.profileList;
      res.defaultPermissionMatrix = existingMetamodel.defaultPermissionMatrix;
    } else {
      res.profileList = [];
      mandatoryProfiles.forEach(p => res.profileList.push(
        {code: p, name: p, desc: p, disableImplicitPermissions: false, enabledExplicitTypeList: ["uu-businessterritory-maing01/uuRoleGroupIfc"]}));
      profileList.forEach(p => {
        if (mandatoryProfiles.indexOf(p) < 0) {
          res.profileList.push(
            {code: p, name: p, desc: p, disableImplicitPermissions: false, enabledExplicitTypeList: ["uu-businessterritory-maing01/uuRoleGroupIfc"]})
        }
      });
    }

    let profilesIndex = new Map();
    res.profileList.forEach((p, i) => profilesIndex.set(p.code, i));

    Object.keys(profilesUcMap).forEach(uc => {
      let ucProfiles = profilesUcMap[uc];
      let profiles = ucProfiles.profileList || ucProfiles;
      let key = res.schemaVersion == "0.1.0" ? uc : `${res.code}/${uc}`;
      res.useCaseProfileMap[key] = this._getProfilesMatrix(profiles, profilesIndex)
    });

    return res;
  }

  createMetaModelV2(existingMetamodel, profiles, mandatoryProfiles) {
    const template = JSON.parse(fs.readFileSync(path.resolve(__dirname, "../", "resources/template-2.0.json"), FILE_READ_OPTIONS));
    let res = template;
    if (existingMetamodel) {
      this._fillHeader(res, existingMetamodel);
    }

    let profileList = profiles["*"].profileList;
    profileList = profileList.filter(p => !IGNORED_PROFILES.includes(p));
    if (existingMetamodel) {
      if (!this._checkArrayEquals(profileList, existingMetamodel.roleGroupProfileList.map(p => p.code))) {
        console.log("Profiles are not same !!!");
        console.log(`profiles.json : ${profileList.join(", ")}`)
        console.log(`metamodel.json: ${existingMetamodel.roleGroupProfileList.map(p => p.code).join(", ")}`)
        return;
      }
    }
    let profilesUcMap = profiles["*"].useCaseMap;

    if (mandatoryProfiles.some(i => !(profileList.indexOf(i) > -1))) {
      throw "Missing mandatory profile. You must have at least these 3 profiles in your profiles.json : Authorities, Executives, Auditors. If you have these profiles with different name, please use --mandatory-profiles attribute to map it.";
    }

    if (existingMetamodel) {
      res.roleGroupProfileList = existingMetamodel.roleGroupProfileList;
      res.roleProfileList = existingMetamodel.roleProfileList;
      res.defaultPermissionMatrix = existingMetamodel.defaultPermissionMatrix;
    } else {
      res.roleGroupProfileList = [];
      mandatoryProfiles.forEach(p => res.roleGroupProfileList.push(
        {code: p, name: p, desc: p, disableImplicitPermissions: false, enabledExplicitTypeList: ["uu-businessterritory-maing01/uuRoleGroupIfc"]}));
      profileList.forEach(p => {
        if (mandatoryProfiles.indexOf(p) < 0) {
          res.roleGroupProfileList.push(
            {code: p, name: p, desc: p, disableImplicitPermissions: false, enabledExplicitTypeList: ["uu-businessterritory-maing01/uuRoleGroupIfc"]})
        }
      });
    }

    let profilesIndex = new Map();
    res.roleGroupProfileList.forEach((p, i) => profilesIndex.set(p.code, i));

    Object.keys(profilesUcMap).forEach(uc => {
      let ucProfiles = profilesUcMap[uc];
      let profiles = ucProfiles.profileList || ucProfiles;
      let key = res.schemaVersion == "0.1.0" ? uc : `${res.code}/${uc}`;
      res.useCaseProfileMap[key] = {
        roleGroupProfileMaskList: [this._getProfilesMatrix(profiles, profilesIndex)],
        roleProfileMaskList: existingMetamodel?.useCaseProfileMap[key]?.roleProfileMaskList || ["00000000-00000000-00000000-00000000"]
      };
    });

    return res;
  }

  _getProfilesMatrix(profiles, profilesIndexMap) {
    let res = new Array(32).fill(0);
    profiles.forEach(p => {
      if (!IGNORED_PROFILES.includes(p)) {
        if (!profilesIndexMap.has(p)) {
          throw `Unknown profile ${p}`;
        }
        res[profilesIndexMap.get(p)] = 1
      }
    });

    let parts = [];
    let i, j, temparray, chunk = 8;
    for (i = 0, j = res.length; i < j; i += chunk) {
      temparray = res.slice(i, i + chunk);
      parts.push(temparray.join(""))
    }
    return parts.join("-");
  }

  _fillHeader(res, existingMetamodel) {
    res.code = existingMetamodel.code;
    res.name = existingMetamodel.name;
    res.version = existingMetamodel.version;
    res.desc = `${existingMetamodel.code} - metamodel`;
    res.schemaVersion = `${existingMetamodel.schemaVersion}`;
    if (res.defaultCategory) {
      res.defaultCategory = `${existingMetamodel.defaultCategory}`
    }
    res.stateList = existingMetamodel.stateList;
    if (res.ancestorPathMap) {
      res.ancestorPathMap = existingMetamodel.ancestorPathMap;
    }
    if (res.ancestorPathList) {
      res.ancestorPathList = res.ancestorPathList;
    }
    res.ancestorMap = existingMetamodel.ancestorMap;
    res.synchronizeUuCmdMap = existingMetamodel.synchronizeUuCmdMap;
    res.routeMap = existingMetamodel.routeMap;
    if (res.typeMap) {
      res.typeMap = existingMetamodel.typeMap;
    }
  }

  _checkArrayEquals(a, b) {
    let array1 = a.slice().sort();
    let array2 = b.slice().sort();
    return (array1.length == array2.length) && array1.every(function (element, index) {
      return element === array2[index];
    });
  }
}

module.exports = new SupportMetamodelgeneratorAbl();
