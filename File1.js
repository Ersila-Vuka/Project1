var _rulesObj;
var _urlModulesBbs;
var _urlModules;
var chosenProcTypeOptions = {};
var _urlProduct;
var _urlProcedures;
var _labels;

function initBbs(rulesObj, emptySelect, urlModulesBbs, urlModules, urlProduct, urlProcedures, labels, noProcType) {
    _rulesObj = rulesObj;
    labelSelect = emptySelect;
    _urlModulesBbs = urlModulesBbs;
    _urlModules = urlModules;
    _urlProduct = urlProduct;
    _urlProcedures = urlProcedures;
    _labels = labels;
    initValidateForm('.form-validation');
    initBbsGrid();
    initBbsEvents();
    chosenProcTypeOptions.chosenOptions = {
        'placeholder_text_multiple': emptySelect,
        'no_results_text': noProcType,
        'display_selected_options': false
    };
}

function initBbsGrid() {

     //******** BBS Grid ********
    initMvcGrid('#bbs-grid .mvc-grid', function (tr, row, ev) {
        if (ev.target.className === 'mvc-grid-empty')
            return;
        if (_rulesObj.indexOf("Update.BBS.Rules") > -1) {
            enableBBSEditForm();
        }
        else {
            disableBBSEditForm();
        } 
        if (ev.target.dataset.type === undefined) {
            resetValidateForm("#modalBbsEditForm");                    
            $('#modal-edit-bbs-procType').parent().removeClass('redborder');

            $('#modal-edit-bbs-product').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            startLoading();
            $.getJSON(_urlProduct, { familyOid: row.FamilyOid }, function (result) {
                //Popolo la combo con i products relativi alla family selezionata
                $.each(result.productsList, function (index, product) {
                    if (product.oid == row.ProductOid) {
                        $('#modal-edit-bbs-product').append('<option selected value="' + product.oid + '">' + product.name + '</option>');
                    }
                    else {
                        $('#modal-edit-bbs-product').append($("<option/>", {
                            value: product.oid,
                            text: product.name
                        }));
                    }
               });
                //Abilito la combo
                $('#modal-edit-bbs-product').prop("disabled", false);
                stopLoading();
            });     

            $('#modal-edit-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            startLoading();
            $.getJSON(_urlProcedures, { productOid: row.ProductOid }, function (result) {
                //Popolo la combo con i procedures relativi alla product selezionata
                $.each(result.proceduresList, function (index, procedure) {
                    if (procedure.oid == row.ProcedureOid) {
                        $('#modal-edit-bbs-procedure').append('<option selected value="' + procedure.oid + '">' + procedure.name + '</option>');
                    }
                    else {
                        $('#modal-edit-bbs-procedure').append($("<option/>", {
                            value: procedure.oid,
                            text: procedure.name
                        }));
                    }
                });
                //Abilito la combo
                $('#modal-edit-bbs-procedure').prop("disabled", false);
                stopLoading();
            });

            populateModule("#modal-edit-bbs-module", row.ProcedureOid, row.ModuleOid);
            populateProcedureTypesList("#modal-edit-bbs-procType", row.ProcedureOid,row.Oid);

            $('#modal-edit-bbs-modulebbs').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            startLoading();
            $.getJSON(_urlModulesBbs, { procedureCode: row.ProcedureBBSOid }, function (result) {
                //Popolo la combo con i modules bbs relativi alla procedure bbs selezionata
                $.each(result, function (index, modulebbs) {
                    if (modulebbs.qU04_OID == row.ModuleBBSOid) {
                        $('#modal-edit-bbs-modulebbs').append('<option selected value="' + modulebbs.qU04_OID + '">' + modulebbs.qU04_DESCRIZIONE + '</option>');
                    } else {
                        $('#modal-edit-bbs-modulebbs').append($("<option/>", {
                            value: modulebbs.qU04_OID,
                            text: modulebbs.qU04_DESCRIZIONE
                        }));
                    }
                });
                //Abilito la combo
                $('#modal-edit-bbs-modulebbs').prop("disabled", false);
                stopLoading();
            });

            $(".modal-body #modal-edit-bbs-code").prop("disabled", true);
            $('.modal-body #modal-edit-bbs-code').val(row.Oid);
            $('.modal-body #modal-edit-bbs-family').val(row.FamilyOid);
            $('.modal-body #modal-edit-bbs-procedurebbs').val(row.ProcedureBBSOid);
            $('.modal-body #modal-edit-bbs-modulebbs').val(row.ModuleBBSOid);
            $('.modal-body #modal-edit-bbs-enabled').prop('checked', row.Enabled == 'True');
            $('#modalBbsEdit').modal('show');
        }
        else if (ev.target.dataset.type === 'deleteBbs') {
            showDeleteConfirmPopup({
                yesCallback: function () {
                    var id = row.Oid;
                    postAjax('/BBS/DeleteBBS', id, function (responseData) {
                        if (responseData.result && responseData.result.success) {
                            stopLoading();
                            if (!responseData.error) {
                                showNotify(responseData.result.message, "success");
                                refreshBbsGrid('');
                                $("#confirmDeletePopup").modal('hide');
                            }

                        } else {
                            $("#confirmDeletePopup").modal('hide');
                            stopLoading();
                            showNotify(responseData.result.message, "warning");
                        }
                    });
                },
                noCallback: function () {
                    $("#confirmDeletePopup").modal('hide');
                }
            });
        }
    });
    //******** End BBS Grid ********
}
//confirm modal quando fai delete
function showDeleteConfirmPopup(config) {
    var popup = $("#confirmDeletePopup");

    var yesBtn = document.getElementById('confirmDeletePopup-yesBtn');
    var noBtn = document.getElementById('confirmDeletePopup-noBtn');

    //append callback functions
    yesBtn.onclick = config.yesCallback;
    noBtn.onclick = config.noCallback;

    //set text for buttons
    if (config.yesButtonText)
        yesBtn.innerText = config.yesButtonText;
    else
        yesBtn.innerText = "Si";
    if (config.noButtonText)
        noBtn.innerText = config.noButtonText;
    else
        noBtn.innerText = "No";

    //show this popup
    popup.modal("show");
}

function initBbsEvents() {
    $('#bbs-grid .content-refresh').on('click', function () {
        refreshBbsGrid();
    });

    $('#bbs-grid .content-add').on('click', function () {
        initAndClearCreateBbsForm();
        $('#modalBbsCreate').modal('show');
    });

    //******** ADD METHOD ********
    $('#btn-create-bbs').on('click', function () {
        if ($("#modalBbsCreateForm").valid()) {
            var family = $('#modal-create-bbs-family').val();
            var product = $('#modal-create-bbs-product').val();
            var procedure = $('#modal-create-bbs-procedure').val();
            var module = $('#modal-create-bbs-module').val();
            var procedurebbs = $('#modal-create-bbs-procedurebbs').val();
            var modulebbs = $('#modal-create-bbs-modulebbs').val();
            $('#modal-create-bbs-procType').parent().removeClass('redborder');

            var selectedProcType = getSelectedOptions('#modal-create-bbs-procType', chosenProcTypeOptions);
            var data = {
                FamilyOid: family,
                ProductOid: product,
                ProcedureOid: procedure,
                ModuleOid: module,
                ProcedureBBSOid: procedurebbs,
                ProcedureBBSName: $("#modal-create-bbs-procedurebbs option:selected").text(),
                ModuleBBSOid: modulebbs,
                ModuleBBSName: $("#modal-create-bbs-modulebbs option:selected").text(),
                ProcedureTypeBbsList: selectedProcType,
                Enabled: $('#modal-create-bbs-enabled').is(":checked")
            };

            postAjax('/BBS/AddBBS', data, function (responseData) {
                if (responseData.result && responseData.result.success) {
                    stopLoading();
                    showNotify(responseData.result.message, "success");
                    showEditNoRow(responseData);
                    refreshBbsGrid();
                    $('#modalBbsCreate').modal('hide');
                }
                else {
                    stopLoading();
                    showNotify(responseData.result.message, "warning");
                }
            });
        }
        else { // Check if multiselect is valid 
            if ($('#modal-create-bbs-procType').valid()) {
                $('#modal-create-bbs-procType').parent().removeClass('redborder');
            }
            else {
                $('#modal-create-bbs-procType').parent().addClass('redborder');
            }
        }
    });

    
    $('#modal-create-bbs-family').on('change', function () {
        startLoading();
        $.getJSON(_urlProduct, { familyOid: $(this).val() }, function (result) {
            //Pulisco la combo delle prodotti, procedure e dei modules
            $('#modal-create-bbs-product').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $("#modal-create-bbs-procType").val(null).trigger("chosen:updated");
            $('#modal-create-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $('#modal-create-bbs-module').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            //Popolo la combo con le prodotti relative alla famiglia selezionata
            $.each(result.productsList, function (index, product) {
                $('#modal-create-bbs-product').append($("<option/>", {
                    value: product.oid,
                    text: product.name
                }));
            });
            //Abilito la combo
            $('#modal-create-bbs-product').prop("disabled", false);
            stopLoading();
        })

    });

    $('#modal-create-bbs-product').on('change', function () {
        startLoading();
        $.getJSON(_urlProcedures, { productOid: $(this).val() }, function (result) {
            //Pulisco la combo deli modules
            $('#modal-create-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $("#modal-create-bbs-procType").val(null).trigger("chosen:updated");
            $('#modal-create-bbs-module').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            //Popolo la combo con i procedure relativi all prodotto selezionato
            $.each(result.proceduresList, function (index, procedure) {
                $('#modal-create-bbs-procedure').append($("<option/>", {
                    value: procedure.oid,
                    text: procedure.name
                }));
            });
            //Abilito la combo
            $('#modal-create-bbs-procedure').prop("disabled", false);
            stopLoading();
        })
    });


    $('#modal-create-bbs-procedurebbs').on('change', function () {    
        try {
            startLoading();
            $.getJSON(_urlModulesBbs, { procedureCode: $(this).val() }, function (result) {
                //Pulisco la combo dei modules
                $('#modal-create-bbs-modulebbs').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
                //Popolo la combo con i modulesbbs relativi alla procedurabbs selezionata
                $.each(result, function (index, module) {
                    $('#modal-create-bbs-modulebbs').append($("<option/>", {
                        value: module.qU04_OID,
                        text: module.qU04_DESCRIZIONE
                    }));
                });
                //Abilito la combo
                $('#modal-create-bbs-modulebbs').prop("disabled", false);
                
            })
        }
        finally {
            stopLoading();
        }
    });
    //******** End ADD METHOD ********

    //******** EDIT METHOD ********
    $('#btn-edit').on('click', function () {
        if ($("#modalBbsEditForm").valid()) {
            var family = $('#modal-edit-bbs-family').val();
            var product = $('#modal-edit-bbs-product').val();
            var procedure = $('#modal-edit-bbs-procedure').val();
            var module = $('#modal-edit-bbs-module').val();
            var procedurebbs = $('#modal-edit-bbs-procedurebbs').val();
            var modulebbs = $('#modal-edit-bbs-modulebbs').val();
            $('#modal-edit-bbs-procType').parent().removeClass('redborder');

            var procType = getSelectedOptions('#modal-edit-bbs-procType', chosenProcTypeOptions);
            var data = {
                Oid: $('#modal-edit-bbs-code').val(),
                FamilyOid: family,
                ProductOid: product,
                ProcedureOid: procedure,
                ModuleOid: module,
                ProcedureBBSOid: procedurebbs,
                ProcedureBBSName: $("#modal-edit-bbs-procedurebbs option:selected").text(),
                ModuleBBSOid: modulebbs,
                ModuleBBSName: $("#modal-edit-bbs-modulebbs option:selected").text(),
                ProcedureTypeBbsList: procType,
                Enabled: $('#modal-edit-bbs-enabled').is(":checked")
            };

            postAjax('/BBS/UpdateBBS', data, function (responseData) {
                if (responseData.result && responseData.result.success) {
                    stopLoading();
                    showNotify(responseData.result.message, "success");
                    refreshBbsGrid();
                }
                else {
                    stopLoading();
                    showNotify(responseData.result.message, "warning");
                }
            });
        }
        else { // Check if multiselect is valid 
            if ($('#modal-edit-bbs-procType').valid()) {
                $('#modal-edit-bbs-procType').parent().removeClass('redborder');
            }
            else {
                $('#modal-edit-bbs-procType').parent().addClass('redborder');
            }
        }

    });

    $('#modal-edit-bbs-family').on('change', function () {
        startLoading();
        $.getJSON(_urlProduct, { familyOid: $(this).val() }, function (result) {
            //Pulisco la combo delle prodotti, procedure e dei modules
            $('#modal-edit-bbs-product').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $('#modal-edit-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $("#modal-edit-bbs-procType").val(null).trigger("chosen:updated");
            $('#modal-edit-bbs-module').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            //Popolo la combo con le prodotti relative alla famiglia selezionata
            $.each(result.productsList, function (index, product) {
                $('#modal-edit-bbs-product').append($("<option/>", {
                    value: product.oid,
                    text: product.name
                }));
            });
            //Abilito la combo
            $('#modal-edit-bbs-product').prop("disabled", false);
            stopLoading();
        })

    });
    $('#modal-edit-bbs-product').on('change', function () {
        startLoading();
        $.getJSON(_urlProcedures, { productOid: $(this).val() }, function (result) {
            //Pulisco la combo deli modules
            $('#modal-edit-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            $("#modal-edit-bbs-procType").val(null).trigger("chosen:updated");
            $('#modal-edit-bbs-module').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            //Popolo la combo con i procedure relativi all prodotto selezionato
            $.each(result.proceduresList, function (index, procedures) {
                $('#modal-edit-bbs-procedure').append($("<option/>", {
                    value: procedures.oid,
                    text: procedures.name
                }));
            });
            //Abilito la combo
            $('#modal-edit-bbs-procedure').prop("disabled", false);
            stopLoading();
        })
    });

    $('#modal-edit-bbs-procedurebbs').on('change', function () {
        startLoading();
        $.getJSON(_urlModulesBbs, { procedureCode: $(this).val() }, function (result) {
            //Pulisco la combo dei modules
            $('#modal-edit-bbs-modulebbs').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
            //Popolo la combo con i modulesbbs relativi alla procedurabbs selezionata
            $.each(result, function (index, module) {

                $('#modal-edit-bbs-modulebbs').append($("<option/>", {
                    value: module.qU04_OID,
                    text: module.qU04_DESCRIZIONE
                }));
            });
            //Abilito la combo
            $('#modal-edit-bbs-modulebbs').prop("disabled", false);
            stopLoading();
        })       
    });

    //********End EDIT METHOD ********
}



function initAndClearCreateBbsForm() {
    resetValidateForm("#modalBbsCreateForm");
    $('#modal-create-bbs-family').prop("selectedIndex", 0);
    $('#modal-create-bbs-modulebbs').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    $('#modal-create-bbs-product').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    $('#modal-create-bbs-product').prop("disabled", false);
    $('#modal-create-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    $('#modal-create-bbs-procedure').prop("disabled", false);
    $('#modal-create-bbs-module').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    $('#modal-create-bbs-module').prop("disabled", false);
    $('#modal-create-bbs-procedurebbs').prop("selectedIndex", 0);
    $('#modal-create-bbs-enabled').prop('checked', true);
    var createProcTypes = $("#modal-create-bbs-procType");
    createProcTypes.attr('disabled', true).trigger("chosen:updated");
    createProcTypes.parent().removeClass('redborder');
    createChosenSelect('#modal-create-bbs-procType', {}, chosenProcTypeOptions);

}

function enableBBSEditForm() {
    $(".modal-body #modal-edit-bbs-code").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-family").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-product").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-procedure").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-module").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-procedurebbs").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-modulebbs").prop("disabled", false);
    $(".modal-body #modal-edit-bbs-enabled").prop("disabled", false);
    $("#modal-edit-bbs-procType").attr('disabled', false).trigger("chosen:updated");
    
}
function disableBBSEditForm() {
    $(".modal-body #modal-edit-bbs-code").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-family").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-product").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-procedure").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-module").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-procedurebbs").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-modulebbs").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-enabled").prop("disabled", true);
    $("#modal-edit-bbs-procType").attr('disabled', true).trigger("chosen:updated");

}
function searchBbs() {
    var keyword = $('.gridSearch input[type="text"]').val();
    $('#bbs-grid .mvc-grid').mvcgrid
        ({
            query: 'keyword=' + encodeURIComponent(keyword),
            reload: true
        });
}


function showEditNoRow(bbs) {
    if (_rulesObj.indexOf("Update.BBS.Rules") > -1) {
        enableBBSEditForm();
    } else {
        disableBBSEditForm();
    }

    $('#modal-edit-bbs-modulebbs').empty().append("<option value='' selected disabled>" + _labels.Shared_EmptySelect + "</option>");
    startLoading();
    $.getJSON(_urlModulesBbs, { procedureCode: bbs.procedureBBSOid }, function (result) {

        //Popolo la combo con i modules bbs relativi alla procedure bbs selezionata
        $.each(result, function (index, module) {

            if (module.qU04_OID == bbs.moduleBBSOid) {
                $('#modal-edit-bbs-modulebbs').append('<option selected value="' + module.qU04_OID + '">' + module.qU04_DESCRIZIONE + '</option>');

            } else {
                $('#modal-edit-bbs-modulebbs').append($("<option/>", {
                    value: module.qU04_OID,
                    text: module.qU04_DESCRIZIONE
                }));
            }

        });
        //Abilito la combo
        $('#modal-edit-bbs-modulebbs').prop("disabled", false);
        stopLoading();
    });   

    $('#modal-edit-bbs-product').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    startLoading();
    $.getJSON(_urlProduct, { familyOid: bbs.familyOid }, function (result) {

        //Popolo la combo con le prodotti relative alla famiglia selezionata
        $.each(result.productsList, function (index, product) {
            if (product.oid == bbs.productOid) {
                $('#modal-edit-bbs-product').append('<option selected value="' + product.oid + '">' + product.name + '</option>');
            }
            else {
                $('#modal-edit-bbs-product').append($("<option/>", {
                    value: product.oid,
                    text: product.name
                }));
            }
        });
        //Abilito la combo
        $('#modal-edit-bbs-product').prop("disabled", false);
        stopLoading();
    });

    $('#modal-edit-bbs-procedure').empty().append("<option value='' selected >" + _labels.Shared_EmptySelect + "</option>");
    startLoading();
    $.getJSON(_urlProcedures, { productOid: bbs.productOid }, function (result) {

        //Popolo la combo con le prodotti relative alla famiglia selezionata
        $.each(result.proceduresList, function (index, procedure) {
            if (procedure.oid == bbs.procedureOid) {
                $('#modal-edit-bbs-procedure').append('<option selected value="' + procedure.oid + '">' + procedure.name + '</option>');
            }
            else {
                $('#modal-edit-bbs-procedure').append($("<option/>", {
                    value: procedure.oid,
                    text: procedure.name
                }));
            }
        });
        //Abilito la combo
        $('#modal-edit-bbs-procedure').prop("disabled", false);
        stopLoading();
    });   

    populateModule("#modal-edit-bbs-module", bbs.procedureOid, bbs.moduleOid);
    populateProcedureTypesList("#modal-edit-bbs-procType", bbs.procedureOid, bbs.oid);

    //Imposto i dati della bbs selezionata
    $(".modal-body #modal-edit-bbs-code").val(bbs.oid);
    $(".modal-body #modal-edit-bbs-code").prop("disabled", true);
    $(".modal-body #modal-edit-bbs-procedure").val(bbs.procedureOid);
    $(".modal-body #modal-edit-bbs-procedurebbs").val(bbs.procedureBBSOid);
    $(".modal-body #modal-edit-bbs-family").val(bbs.familyOid);
    $(".modal-body #modal-edit-bbs-product").val(bbs.productOid);
    $(".modal-body #modal-edit-bbs-module").val(bbs.moduleOid);
    $(".modal-body #modal-edit-bbs-modulebbs").val(bbs.moduleBBSOid);

    var _enabled = ((bbs.enabled == "True") || (bbs.enabled == "true") || (bbs.enabled == true)) ? true : false;
    $(".modal-body #modal-edit-bbs-enabled").prop('checked', _enabled);


    resetValidateForm("#modalBbsEditForm");
    $('#modalBbsEdit').modal('show');
}

function refreshBbsGrid() {
    $('#bbs-grid .mvc-grid').mvcgrid({
        reload: true
    });
}

$('#modal-create-bbs-procedure').on('change', function () {
    startLoading();
    form = $(this).closest("form");
    let element = form.find(".moduleSelect").first();
    populateModule(element, this.value, '');

    let elementProc = form.find("#modal-create-bbs-procType").first();
    elementProc.prop('disabled', false);
    if (this.options[this.selectedIndex].text !== _labels.Shared_EmptySelect) {
        populateProcedureTypesList(elementProc, this.value, null);
    }
    else {
        $("#modal-create-bbs-procType").attr('disabled', true).trigger("chosen:updated");
        $("#modal-create-bbs-module").trigger("chosen:updated");
        createChosenSelect("#" + $(elementProc).attr('id'), [], chosenProcTypeOptions);
    }
    stopLoading();
});


$('#modal-edit-bbs-procedure').on('change', function () {
    startLoading();
    form = $(this).closest("form");
    let element = form.find(".moduleSelect").first();
    populateModule(element, this.value, '');

    let elementProc = form.find(".procedureTypeSelect").first();
    elementProc.prop('disabled', false);
    if (this.options[this.selectedIndex].text !== _labels.Shared_EmptySelect) {
        populateProcedureTypesList(elementProc, this.value, null);
    }
    else {
        $("#modal-edit-bbs-procType").attr('disabled', false).trigger("chosen:updated");
        $("#modal-edit-bbs-module").attr('disabled', false).trigger("chosen:updated");
        createChosenSelect("#" + $(elementProc).attr('id'), [], chosenProcTypeOptions);
    }
    stopLoading();
});

function populateModule(element, procedure, moduleId) {
    $(element).empty();
    $.getJSON(_urlModules, { procedureOid: procedure }, function (response) {
        //Pulisco la combo deli modules
        if (response.result !== null && response.result.success) {
            $(element).append('<option value="" selected>' + _labels.Shared_EmptySelect + '</option>');
            $.each(response.modulesProcedureList, function (index, module) {
                if (moduleId !== '' && module.oid == moduleId)
                    $(element).append('<option value="' + module.oid + '" selected>' + module.name + '</option>');
                else
                    $(element).append('<option value="' + module.oid + '">' + module.name + '</option>');
            });
        }
        else {
            $('#modal-edit-bbs-module').empty().append('<option selected="" value="">' + _labels.Shared_EmptySelect + '</option>');
        }
    })
}


function populateProcedureTypesList(elementProc, procedureCode, bbsCode) {
    $(elementProc).empty();
    try {
        //on edit part
        if (bbsCode != null) {
            $.when($.getJSON("/BBS/GetProcedureTypesByBBS", { bbsOid: bbsCode }), $.getJSON("/ACPProcedures/GetACPProcedure", { Oid: procedureCode })).done(function (response1, response2) {
                if (response1[1] == 'success' && response2[1] == 'success') {
                    if (response1[0].result !== null && response1[0].result.success) {
                        $.each(response2[0].procedureTypeListSelected, function (i, d) {
                            $(elementProc).append('<option value="' + d.id + '">' + d.name + '</option>');
                        });
                        if (response1[0].result !== null && response1[0].result.success) {
                            createChosenSelect("#" + $(elementProc).attr('id'), response1[0].procedureTypeBbsList || [], chosenProcTypeOptions);
                        } else {
                            showNotify(response1[0].result.message);
                        }
                    } else {
                        showNotify(response1[0].result.message);
                    }
                }
                
            });
        }
        else {
            $.getJSON("/ACPProcedures/GetACPProcedure", { Oid: procedureCode }).done(function (response) {
                if (response.result !== null && response.result.success) {
                    $.each(response.procedureTypeListSelected, function (i, d) {
                        $(elementProc).append('<option value="' + d.id + '">' + d.name + '</option>');
                    });
                    createChosenSelect("#" + $(elementProc).attr('id'), [], chosenProcTypeOptions);
                }

            });
        }
    }
    finally {
        stopLoading();
    }
      
}
