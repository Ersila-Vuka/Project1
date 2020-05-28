using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Caching.Distributed;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using System;
using System.Collections.Generic;
using System.Linq;
using TeamSystem.IT.Framework.Utilities.CustomExeptions;
using TeamSystem.IT.MPR.DTOs.Core.BBS;
using TeamSystem.IT.MPR.DTOs.Core.Families;
using TeamSystem.IT.MPR.DTOs.Core.Modules;
using TeamSystem.IT.MPR.DTOs.Core.Procedures;
using TeamSystem.IT.MPR.DTOs.Core.Products;
using TeamSystem.IT.MPR.DTOs.Core.Products_Procedure;
using TeamSystem.IT.Pandora.Core.Interface;
using TeamSystem.IT.Pandora.Core.Object;
using TeamSystem.IT.Pandora.Core.Utility;
using TeamSystem.IT.Pandora.DTOs.Auth;
using TeamSystem.IT.Pandora.DTOs.Configuration;
using TeamSystem.IT.Pandora.HybridApp.PLM.Models.Registries.ACPFamilies;
using TeamSystem.IT.Pandora.HybridApp.PLM.Models.Registries.ACPFamiliesRD;
using TeamSystem.IT.Pandora.HybridApp.PLM.Models.Registries.ACPProcedures;
using TeamSystem.IT.Pandora.HybridApp.PLM.Models.Registries.ACPProducts;
using TeamSystem.IT.Pandora.HybridApp.PLM.Models.Registries.BBS;
using TeamSystem.IT.Pandora.HybridApp.PLM.Resources;
using TeamSystem.IT.Pandora.HybridApp.PLM.Services;
using TeamSystem.IT.Pandora.HybridApp.PLM.Services.ProductRegistries.Interfaces;
using TeamSystem.IT.Pandora.HybridApp.PLM.Services.Registries.Interface;
using TeamSystem.IT.Pandora.HybridApp.PLM.Utility;

namespace TeamSystem.IT.Pandora.HybridApp.PLM.Controllers.Registries
{
    public class BBSController : NetCorePandoraController
    {
        #region Dichiarazione variabili

        private readonly AppSettings _appSettings;
        private readonly ILogger<BBSController> _logger;
        private readonly IBbsService _bbsService;
        private readonly IRefBbsService _refBbsService;
        private readonly IBbsMDALService _bbsMDALService; 

        #endregion

        public BBSController(IOptions<AppSettings> appSettings, IBbsService bbsService, IBbsMDALService bbsMDALService, IRefBbsService refBbsService,IDistributedCache distributedCache, ILogger<BBSController> logger)
        {
            _logger = logger;
            _appSettings = appSettings.Value;
            _distributedCache = distributedCache;
            _bbsService = bbsService;
            _refBbsService = refBbsService;
            _bbsMDALService = bbsMDALService;
        }

        [HttpGet]
        public IActionResult BbsGrid(string keyword, int? page, int? rows, string sort, string order)
        {
            BbsGridModel model = new BbsGridModel();
            ResponseResult result = new ResponseResult
            {
                Success = false
            };
            model.Bbs = new List<BBSRelations>();

            try
            {
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);
                #region Verifica Validità Access Token

                if (PandoraUtility.IsAccessTokenExpired(session.AccessToken))
                {
                    string pandoraTokenPath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_TOKEN_PATH;
                    AuthorizationData authData = PandoraUtility.GetNewAccessToken(pandoraTokenPath, session.UserCode, session.Username, session.Refreshtoken);
                    session.AccessToken = authData.Access_Token;
                    session.Refreshtoken = authData.Refresh_Token;
                    NetCoreUtility.SetSession(HttpContext, session);
                }

                #endregion

                #region Verifica Rules

                List<string> rulesList = new List<string> { AppUtility.Rules.ReadBBSRule, AppUtility.Rules.DeleteBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion

                #region Recupero le Bbs

                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.ReadBBSRule))
                {
                    GetBBSRequest request = new GetBBSRequest()
                    {
                        Keyword = keyword,
                        //we use || because if a parameter is null or empty, it doesn't cause any error
                        OrderByPropertyName = (string.IsNullOrEmpty(sort) || string.IsNullOrEmpty(order)) ? "Name asc" : sort + " " + order,
                        PageNumber = page ?? 1,
                        PageSize = rows ?? 10
                    };

                    GetBBSResponse response = _bbsService.GetBbs(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_BBS, Commands.GetBBS, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        model.Bbs = response.BBSList;
                        model.TotalRows = response.RecordNumber;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }

                #endregion
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            ViewBag.TotalRows = model.TotalRows;
            model.Result = result;
            return PartialView(model);
        }


        public IActionResult GetProductsForFamily(Guid familyOid)
        {
            ACPProductsForFamilyModel model = new ACPProductsForFamilyModel();
            model.ProductsList = new List<Product>();
            ResponseResult result = new ResponseResult();
            result.Success = false;
            GetProductsResponse response = new GetProductsResponse();

            try
            {

                model.Rules = new List<string>();
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);

                #region Verifica Validità Access Token
                if (PandoraUtility.IsAccessTokenExpired(session.AccessToken))
                {
                    string pandoraTokenPath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_TOKEN_PATH;
                    AuthorizationData authData = PandoraUtility.GetNewAccessToken(pandoraTokenPath, session.UserCode, session.Username, session.Refreshtoken);
                    session.AccessToken = authData.Access_Token;
                    session.Refreshtoken = authData.Refresh_Token;
                    NetCoreUtility.SetSession(HttpContext, session);
                }
                #endregion

                #region Verifica Rules               
                List<string> rulesList = new List<string> { AppUtility.Rules.ReadBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion

                #region Recupero le Products

                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.ReadBBSRule))
                {
                    model.Rules.AddRange(rulesResult.Where(p => p.Value).Select(p => p.Key));                   
                    GetProductsByFamilyRequest request = new GetProductsByFamilyRequest
                    {
                        FamilyOid = familyOid
                    };
                    response = _bbsService.GetProductsForFamily(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_Families, Commands.GetProductsForFamily, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        model.ProductsList = response.ProductsList;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
                #endregion
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }

            model.Result = result;
            return Json(model);
        }

        public IActionResult GetProceduresForProduct(Guid productOid)
        {
            ACPProceduresForProductModel model = new ACPProceduresForProductModel();
            model.ProceduresList = new List<Procedure>();
            ResponseResult result = new ResponseResult();
            result.Success = false;
            GetProceduresResponse response = new GetProceduresResponse();

            try
            {
                model.Rules = new List<string>();
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);

                #region Verifica Validità Access Token
                if (PandoraUtility.IsAccessTokenExpired(session.AccessToken))
                {
                    string pandoraTokenPath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_TOKEN_PATH;
                    AuthorizationData authData = PandoraUtility.GetNewAccessToken(pandoraTokenPath, session.UserCode, session.Username, session.Refreshtoken);
                    session.AccessToken = authData.Access_Token;
                    session.Refreshtoken = authData.Refresh_Token;
                    NetCoreUtility.SetSession(HttpContext, session);
                }
                #endregion

                #region Verifica Rules               
                List<string> rulesList = new List<string> { AppUtility.Rules.ReadBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion

                #region Recupero le Procedures

                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.ReadBBSRule))
                {
                    model.Rules.AddRange(rulesResult.Where(p => p.Value).Select(p => p.Key));
                    GetProceduresByProductRequest request = new GetProceduresByProductRequest
                    {
                        ProductOid = productOid
                    };
                    response = _bbsService.GetProceduresForProduct(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_ACPProcedures, Commands.GetProceduresForProduct, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        model.ProceduresList = response.ProceduresList;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
                #endregion
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }

            model.Result = result;
            return Json(model);
        }

        [HttpPost]
        public IActionResult AddBBS([FromBody]BBSAddModel bbs)
        {
            ResponseResult result = new ResponseResult();
            try
            {
                result.Success = false;
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null)
                    return new StatusCodeResult(440);
                #region Verifica Rules

                List<string> rulesList = new List<string> { AppUtility.Rules.AddBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion
                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.AddBBSRule))
                {
                    AddBBSRequest request = new AddBBSRequest()
                    {
                       FamilyOid = bbs.FamilyOid,
                       ProductOid = bbs.ProductOid,
                       ProcedureOid = bbs.ProcedureOid,
                       ModuleOid = bbs.ModuleOid,
                       ProcedureBBSOid = bbs.ProcedureBBSOid,
                       ProcedureBBSName = bbs.ProcedureBBSName,
                       ModuleBBSOid = bbs.ModuleBBSOid,
                       ModuleBBSName = bbs.ModuleBBSName,
                       Enabled = bbs.Enabled,
                       ProcedureTypesList = bbs.ProcedureTypeBbsList?.Select(s => Int32.Parse(s.code)).ToList()

                    };
                    AddBBSResponse response = _bbsService.AddBbs(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Modules.Registries_BBS, Commands.AddBBS, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        bbs.Oid = response.Oid;
                        result.Message = PandoraAppResources.Success_AddBbsRelation;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            bbs.Result = result;
            return Json(bbs);
        }

        [HttpPost]
        public IActionResult UpdateBBS([FromBody]BBSAddModel bbs)
        {
            ResponseResult result = new ResponseResult
            {
                Success = false
            };

            try
            {
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);
                #region Verifica Rules

                List<string> rulesList = new List<string> { AppUtility.Rules.UpdateBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion
                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.UpdateBBSRule))
                {
                    UpdateBBSRelationRequest request = new UpdateBBSRelationRequest()
                    {
                        Oid = bbs.Oid,
                        FamilyOid = bbs.FamilyOid,
                        ProductOid = bbs.ProductOid,
                        ProcedureOid = bbs.ProcedureOid,
                        ModuleOid = bbs.ModuleOid,
                        ProcedureBBSOid = bbs.ProcedureBBSOid,
                        ProcedureBBSName = bbs.ProcedureBBSName,
                        ModuleBBSOid = bbs.ModuleBBSOid,
                        ModuleBBSName = bbs.ModuleBBSName,
                        Enabled = bbs.Enabled,
                        ProcedureTypesList = bbs.ProcedureTypeBbsList?.Select(s => Int32.Parse(s.code)).ToList()
                    };
                    UpdateBBSRelationResponse response = _bbsService.UpdateBbs(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_BBS, Commands.UpdateBBS, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        result.Message = PandoraAppResources.Succes_UpdateBbsRelation;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            bbs.Result = result;
            return Json(bbs);
        }

        [HttpPost]
        public IActionResult DeleteBBS([FromBody] string id)
        {
            BbsDeleteModel model = new BbsDeleteModel();
            ResponseResult result = new ResponseResult
            {
                Success = false
            };
            try
            {
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);

                #region Verifica Rules               
                List<string> rulesList = new List<string> { AppUtility.Rules.DeleteBBSRule };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion
                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.DeleteBBSRule))
                {
                    DeleteBBSRelationRequest request = new DeleteBBSRelationRequest()
                    {
                        BBSRelationOid = Guid.Parse(id),
                        Username = session.UserCode
                    };

                    DeleteBBSRelationResponse response = _bbsService.DeleteBbs(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);

                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_BBS, Commands.DeleteBBS, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        result.Message = PandoraAppResources.Success_DeleteBbs;
                    }
                }
                else
                {
                    result.Success = false;
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            model.Result = result;
            return Json(model);
        }

        public IActionResult GetProcedureTypesByBBS(Guid bbsOid)
        {
            ProcedureTypBBSModel model = new ProcedureTypBBSModel();
            //model.ProcedureTypeBbsList = new List<MPR.DTOs.Core.ProcedureTypes.ProcedureType>();
            ResponseResult result = new ResponseResult();
            try
            {
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null)
                    return new StatusCodeResult(440);
                GetProcedureTypesByBBSRequest request = new GetProcedureTypesByBBSRequest
                {
                    BBSOid = bbsOid
                };
                GetProcedureTypeByBBSResponse response = _bbsService.GetProcedureTypesByBBS(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);

                if (PandoraUtility.CheckEsbStatus(response))
                {
                    result.Message = AppUtility.GetErrorDescription(Utility.Modules.Registries_BBS, Commands.GetProducedureTypesByBBS, response.Status.Code, null, response.Status.Description);
                }
                else
                {
                    result.Success = true;
                    //model.ProcedureTypeBbsList = response.ProcedureTypesList;
                    model.ProcedureTypeBbsList = response.ProcedureTypesList.Select(p => new ProcTypeBbsModel() { code = p.Id.ToString() }).ToList();
                }
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                model.Result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                model.Result.Message = PandoraErrorCodes.Exception_Error;
            }
            model.Result = result;
            return Json(model);
        }

        [HttpGet]
        public IActionResult ModulesBbsList(String procedureCode)
        {
            List<DOL.BBS.DBEntities.Moduli> modulesList = new List<DOL.BBS.DBEntities.Moduli>();

            try
            {
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);

                #region Recupero i Modules

                if (!String.IsNullOrEmpty(procedureCode))
                {
                    //Recupero i modules Bbs relativi ad un procedureCode chiamando l'ESB
                    DOL.BBS.DBEntities.BBSModules response = _refBbsService.GetModulesBbs(session.Username, procedureCode, _appSettings.APP_CODE, _appSettings.TS_ESB_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);

                    if (!PandoraUtility.CheckEsbStatus(response))
                    {
                        modulesList = response.Moduli == null ? new List<DOL.BBS.DBEntities.Moduli>() : response.Moduli.OrderBy(e => e.QU04_DESCRIZIONE).ToList();
                    }
                }

                #endregion
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.Message);
                modulesList = new List<DOL.BBS.DBEntities.Moduli>();

            }

            return Json(modulesList);
        }

        public IActionResult GetBbsModulesForProcedure(Guid procedureOid)
        {
            ModuleProcedureList model = new ModuleProcedureList();
            model.ModulesProcedureList = new List<Module>();
            ResponseResult result = new ResponseResult();
            result.Success = false;
            GetModulesForProcedureResponse response = new GetModulesForProcedureResponse();

            try
            {

                model.Rules = new List<string>();
                PandoraSession session = NetCoreUtility.GetSession(HttpContext);
                if (session == null) return new StatusCodeResult(440);

                #region Verifica Validità Access Token
                if (PandoraUtility.IsAccessTokenExpired(session.AccessToken))
                {
                    string pandoraTokenPath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_TOKEN_PATH;
                    AuthorizationData authData = PandoraUtility.GetNewAccessToken(pandoraTokenPath, session.UserCode, session.Username, session.Refreshtoken);
                    session.AccessToken = authData.Access_Token;
                    session.Refreshtoken = authData.Refresh_Token;
                    NetCoreUtility.SetSession(HttpContext, session);
                }
                #endregion

                #region Verifica Rules               
                List<string> rulesList = new List<string> { AppUtility.Rules.ACPReadProcedure };
                string pandoraRulePath = _appSettings.PANDORA_BASE_PATH + _appSettings.PANDORA_RULE_PATH + "/verifyrules";
                Dictionary<string, bool> rulesResult = VerifyRules(rulesList, session.RandomId, session.AccessToken, session.ScopeId, pandoraRulePath);

                #endregion

                #region Recupero le Relations

                if (PandoraUtility.IsVisibleRule(rulesResult, AppUtility.Rules.ACPReadProcedure))
                {
                    model.Rules.AddRange(rulesResult.Where(p => p.Value).Select(p => p.Key));
                    //need to be changed with the new request and passing the version oid
                    GetModulesForProcedureRequest request = new GetModulesForProcedureRequest
                    {
                        ProcedureOid = procedureOid
                    };
                    response = _bbsService.GetBbsModulesForProcedure(session.Username, request, _appSettings.APP_CODE, _appSettings.TS_ESB_MPR_APPCODE, _appSettings.TS_ESB_VERSION, _appSettings.TS_ESB_PLM_PASSWORD, _appSettings.TS_ESB_URL);
                    if (PandoraUtility.CheckEsbStatus(response))
                    {
                        result.Message = AppUtility.GetErrorDescription(Utility.Modules.ACP_Registries_Modules, Commands.GetBbsModulesByProcedure, response.Status.Code, null, response.Status.Description);
                    }
                    else
                    {
                        result.Success = true;
                        model.ModulesProcedureList = response.ModulesList;
                    }
                }
                else
                {
                    result.Message = PandoraErrorCodes.Permission_Denied;
                }
                #endregion
            }
            catch (BaseException be)
            {
                _logger.LogInformation(be.Message);
                result.Message = PandoraErrorCodes.Exception_Error;
            }
            catch (Exception ex)
            {
                _logger.LogCritical(ex.ToString());
                result.Message = PandoraErrorCodes.Exception_Error;
            }

            model.Result = result;
            return Json(model);
        }
    }
}
