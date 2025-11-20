import { auth } from "./config.js";
import { signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import * as Utils from "./utils.js";
import * as UI from "./ui.js";
import * as Services from "./services.js";
import { getDoc, doc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { db, appId } from "./config.js"; 

// --- ESTADO GLOBAL ---
const State = {
    user: null,
    isMaster: false,
    isSupervisor: false,
    supervisorId: null,
    supervisorSectorId: null,
    sectors: [],
    employees: [],
    supervisors: [],
    history: [],
    editingLaunchId: null,
    itemToDelete: null,
    historyUnsubscribe: null,
    isVacationInput: false 
};

// --- FUNÇÕES AUXILIARES DE UI ---

const updateIndicesTotal = () => {
    let total = 0;
    document.querySelectorAll('#indices-list .index-perc').forEach(i => total += parseFloat(i.value) || 0);
    const totalEl = document.getElementById('indices-total-percentage');
    const btnEl = document.getElementById('btn-submit-indices-form');
    
    if(totalEl) totalEl.textContent = `Total: ${total}%`;
    if(btnEl) btnEl.disabled = total !== 100;
};

const addIndexFieldToModal = (name='', perc='') => {
    const list = document.getElementById('indices-list');
    if (!list) return;

    const div = document.createElement('div');
    div.className = 'flex items-center gap-2 mb-2';
    div.innerHTML = `
        <div class="flex-1"><input class="index-name w-full border p-2 rounded text-sm" placeholder="Nome da Meta" value="${name}"></div>
        <div class="w-24"><input type="number" class="index-perc w-full border p-2 rounded text-sm" placeholder="%" value="${perc}"></div>
        <button type="button" class="text-red-500 rm-idx font-bold px-2">X</button>
    `;
    div.querySelector('.rm-idx').onclick = () => { div.remove(); updateIndicesTotal(); };
    div.querySelector('.index-perc').oninput = updateIndicesTotal;
    list.appendChild(div);
};

const renderIndicesList = (indices) => {
    const list = document.getElementById('indices-list');
    if (!list) return;
    list.innerHTML = '';
    indices.forEach(idx => addIndexFieldToModal(idx.name, idx.perc));
    if(indices.length === 0) addIndexFieldToModal();
    updateIndicesTotal();
};

const renderIndicesInputs = (indices) => {
    const container = document.getElementById('indices-container');
    if (!container) return;
    container.innerHTML = '';
    
    if(!indices || indices.length === 0) {
        container.classList.remove('grid-layout');
        container.innerHTML = '<p class="text-sm text-gray-500">Sem índices definidos para este setor.</p>';
        return;
    }
    
    container.classList.add('grid-layout');
    indices.forEach(idx => {
        const div = document.createElement('div');
        div.className = 'index-item';
        div.innerHTML = `<label>${idx.name} (Max: ${idx.perc}%)</label><input type="number" class="score-input w-full border p-2 rounded" data-max="${idx.perc}" data-name="${idx.name}" min="0" max="${idx.perc}">`;
        
        div.querySelector('input').addEventListener('input', (e) => {
            let val = parseFloat(e.target.value);
            if(val > parseFloat(idx.perc)) e.target.value = idx.perc;
            if(val < 0) e.target.value = 0;
            calculateTotalPreview();
        });
        container.appendChild(div);
    });
};

const calculateTotalPreview = () => {
    const base = parseFloat(document.getElementById('base-value').value) || 0;
    let points = 0;
    document.querySelectorAll('.score-input').forEach(i => points += parseFloat(i.value) || 0);
    document.getElementById('total-calculated').textContent = Utils.formatCurrency(base * (points / 100));
};

const resetLaunchForm = () => {
    State.editingLaunchId = null;
    State.isVacationInput = false; 
    
    document.getElementById('employee-select').value = "";
    document.getElementById('indices-container').innerHTML = '<p class="text-sm text-gray-500">Selecione um colaborador</p>';
    document.getElementById('total-calculated').textContent = "R$ 0,00";
    document.getElementById('btn-submit-launch').textContent = "Lançar Remuneração";
    document.getElementById('btn-cancel-edit').classList.add('hidden');
    
    document.getElementById('indices-container').style.opacity = '1';
    document.getElementById('indices-container').style.pointerEvents = 'auto';
    const month = document.getElementById('month-ref').value;
    Services.getBaseValue(month).then(val => {
        document.getElementById('base-value').value = val || '';
        if(!State.isMaster) document.getElementById('base-value').readOnly = true; 
    });
};

// --- INICIALIZAÇÃO ---

const init = async () => {
    try {
        await signInAnonymously(auth);
        onAuthStateChanged(auth, (user) => {
            State.user = user ? user.uid : null;
            if (State.user) checkMasterExists();
        });
    } catch (e) { console.error("Erro Firebase:", e); }
};

const checkMasterExists = async () => {
    const snap = await Services.checkMaster();
    if (!snap.exists()) document.getElementById('master-register-container')?.classList.remove('hidden');
};

const setupDataListeners = () => {
    Services.subscribeToSectors((data) => {
        State.sectors = data;
        populateSectorSelects();
        renderSectorsTable();
    });

    Services.subscribeToSupervisors((data) => {
        State.supervisors = data;
        renderSupervisorsTable();
    });

    Services.subscribeToEmployees(State.supervisorSectorId, State.isSupervisor, (data) => {
        State.employees = data;
        populateEmployeeSelect();
        renderEmployeesTable();
    });
    
    loadHistory(); 
};

// --- EVENTOS GERAIS ---

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const hash = await Utils.digestMessage(pass);

    State.isMaster = false; State.isSupervisor = false;

    const masterSnap = await Services.checkMaster();
    if (masterSnap.exists()) {
        const m = masterSnap.data();
        if (m.username === user && m.passwordHash === hash) {
            State.isMaster = true; State.supervisorId = 'master';
            loginSuccess(); return;
        }
    }

    const supDoc = await Services.findSupervisor(user, hash);
    if (supDoc) {
        State.isSupervisor = true; 
        State.supervisorId = supDoc.id;
        State.supervisorSectorId = supDoc.data().sectorId;
        loginSuccess(); return;
    }
    document.getElementById('login-error').classList.remove('hidden');
});

const loginSuccess = () => {
    document.getElementById('login-screen').classList.add('hidden');
    document.getElementById('app-content').classList.remove('hidden');
    UI.switchView('launch');
    setDefaultMonth();
    applyPermissions();
    setupDataListeners();
};

document.getElementById('btn-view-launch').addEventListener('click', () => UI.switchView('launch'));
document.getElementById('btn-view-reports').addEventListener('click', () => {
    UI.switchView('reports');
    populateReportFilter();
});
document.getElementById('btn-view-admin').addEventListener('click', () => UI.switchView('admin'));

// Abas do Painel
document.querySelectorAll('.tab-button').forEach(button => {
    button.addEventListener('click', () => {
        document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
        button.classList.add('active');
        const tabId = button.getAttribute('data-tab');
        document.getElementById(`tab-${tabId}`).classList.add('active');
        if (tabId === 'supervisors') renderSupervisorsTable();
        if (tabId === 'sectors') renderSectorsTable();
        if (tabId === 'employees') renderEmployeesTable();
    });
});

document.getElementById('btn-logout').addEventListener('click', () => window.location.reload());
document.getElementById('btn-close-alert').addEventListener('click', () => UI.hideModal('alert-modal'));
document.querySelectorAll('.close, .modal-close-btn').forEach(el => el.addEventListener('click', () => UI.closeAllModals()));
['cancel-supervisor-modal', 'cancel-sector-modal', 'cancel-employee-modal', 'cancel-sector-indices-modal', 'btn-cancel-delete', 'cancel-master-reg', 'cancel-change-pass', 'close-manage-team-modal'].forEach(id => {
    document.getElementById(id)?.addEventListener('click', () => UI.closeAllModals());
});

document.getElementById('btn-open-supervisor-modal').addEventListener('click', () => {
    document.getElementById('supervisor-form').reset();
    document.getElementById('edit-supervisor-id').value = '';
    const showPass = document.getElementById('show-password');
    if(showPass) showPass.checked = false;
    document.getElementById('supervisor-password').type = 'password';
    UI.showModal('supervisor-modal');
});

document.getElementById('show-password')?.addEventListener('change', (e) => {
    const input = document.getElementById('supervisor-password');
    if(input) input.type = e.target.checked ? 'text' : 'password';
});

document.getElementById('btn-open-sector-modal').addEventListener('click', () => {
    document.getElementById('sector-form').reset();
    document.getElementById('edit-sector-id').value = '';
    UI.showModal('sector-modal');
});

document.getElementById('btn-open-employee-modal').addEventListener('click', () => {
    document.getElementById('employee-form').reset();
    document.getElementById('edit-employee-id').value = '';
    const sel = document.getElementById('employee-sector');
    if (State.isSupervisor) {
        sel.value = State.supervisorSectorId;
        sel.disabled = true;
    } else {
        sel.disabled = false;
    }
    UI.showModal('employee-modal');
});

document.getElementById('btn-manage-sector-indices')?.addEventListener('click', () => {
    if (!State.supervisorSectorId) return UI.showAlert("Erro", "Supervisor sem setor definido.");
    const sector = State.sectors.find(s => s.id === State.supervisorSectorId);
    if (sector) {
        document.getElementById('edit-indices-sector-id').value = sector.id;
        document.getElementById('sector-indices-name').value = sector.name;
        renderIndicesList(sector.indices || []);
        UI.showModal('sector-indices-modal');
    } else {
        UI.showAlert("Erro", "Setor não encontrado.");
    }
});

document.getElementById('btn-manage-team')?.addEventListener('click', () => {
    const myEmployees = State.employees; 
    const listEl = document.getElementById('manage-team-list');
    listEl.innerHTML = '';

    if (myEmployees.length === 0) {
        listEl.innerHTML = '<tr><td colspan="2" class="px-4 py-4 text-center text-gray-500">Nenhum colaborador na equipe.</td></tr>';
    } else {
        myEmployees.sort((a,b) => a.name.localeCompare(b.name));
        myEmployees.forEach(emp => {
            const tr = document.createElement('tr');
            tr.className = "hover:bg-gray-50";
            tr.innerHTML = `
                <td class="px-4 py-3 text-sm text-gray-900">${emp.name}</td>
                <td class="px-4 py-3 text-right">
                    <button class="text-red-600 font-bold hover:text-red-800 text-sm" onclick="deleteEmployee('${emp.id}')">Excluir</button>
                </td>
            `;
            listEl.appendChild(tr);
        });
    }
    UI.showModal('manage-team-modal');
});

document.getElementById('add-index-field').addEventListener('click', () => addIndexFieldToModal());

document.getElementById('sector-indices-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const indices = [];
    document.querySelectorAll('#indices-list .flex').forEach(row => {
        const n = row.querySelector('.index-name').value;
        const p = parseFloat(row.querySelector('.index-perc').value);
        if(n && p) indices.push({name: n, perc: p});
    });
    const secId = document.getElementById('edit-indices-sector-id').value;
    await Services.saveIndices(secId, indices);
    UI.showAlert("Sucesso", "Metas salvas!");
    UI.hideModal('sector-indices-modal');
});

// --- CADASTROS ---
document.getElementById('sector-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const name = document.getElementById('sector-name').value.trim();
    const id = document.getElementById('edit-sector-id').value;
    try {
        await Services.saveGenericItem('sectors', { name }, id || null);
        UI.showAlert("Sucesso", "Setor salvo!");
        UI.hideModal('sector-modal');
    } catch (error) { console.error(error); UI.showAlert("Erro", "Erro ao salvar."); }
});

document.getElementById('employee-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('employee-name').value.trim();
    const sectorId = document.getElementById('employee-sector').value;
    const id = document.getElementById('edit-employee-id').value;
    try {
        await Services.saveGenericItem('employees', { name, sectorId }, id || null);
        UI.showAlert("Sucesso", "Colaborador salvo!");
        UI.hideModal('employee-modal');
        if(State.isSupervisor && document.getElementById('manage-team-modal').style.display === 'block') {
             document.getElementById('btn-manage-team').click();
        }
    } catch (error) { console.error(error); UI.showAlert("Erro", "Erro ao salvar."); }
});

document.getElementById('supervisor-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('supervisor-name').value.trim();
    const sectorId = document.getElementById('supervisor-sector').value;
    const username = document.getElementById('supervisor-username').value.toLowerCase();
    const password = document.getElementById('supervisor-password').value;
    const id = document.getElementById('edit-supervisor-id').value;
    
    const sectorTaken = State.supervisors.find(s => s.sectorId === sectorId && s.id !== id);
    if (sectorTaken) return UI.showAlert("Erro", "Este setor já possui um supervisor.");

    const data = { name, sectorId, username };
    if (password) data.passwordHash = await Utils.digestMessage(password);
    else if (!id) return UI.showAlert("Erro", "Senha é obrigatória.");

    try {
        await Services.saveGenericItem('supervisors', data, id || null);
        UI.showAlert("Sucesso", "Supervisor salvo!");
        UI.hideModal('supervisor-modal');
    } catch (error) { console.error(error); UI.showAlert("Erro", "Erro ao salvar."); }
});

document.getElementById('btn-change-password').addEventListener('click', () => {
    document.getElementById('change-password-form').reset();
    UI.showModal('change-password-modal');
});

document.getElementById('change-password-form').addEventListener('submit', async (e) => {
    e.preventDefault(); 
    const oldPass = document.getElementById('cp-old-password').value;
    const newPass = document.getElementById('cp-new-password').value;
    const confirmPass = document.getElementById('cp-confirm-password').value;

    if (newPass !== confirmPass) return UI.showAlert("Erro", "As novas senhas não coincidem.");

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
    if (!passwordRegex.test(newPass)) return UI.showAlert("Senha Inválida", "Mínimo 6 caracteres, maiúscula, minúscula, número e especial.");

    try {
        const oldHash = await Utils.digestMessage(oldPass);
        const newHash = await Utils.digestMessage(newPass);
        let valid = false;

        if (State.isMaster) {
            const snap = await Services.checkMaster();
            if (snap.exists() && snap.data().passwordHash === oldHash) valid = true;
        } else if (State.isSupervisor) {
            const myself = State.supervisors.find(s => s.id === State.supervisorId);
            if (myself && myself.passwordHash === oldHash) valid = true;
        }

        if (!valid) return UI.showAlert("Erro", "Senha ATUAL incorreta.");

        if (State.isMaster) await Services.updateMasterPassword(newHash);
        else await Services.saveGenericItem('supervisors', { passwordHash: newHash }, State.supervisorId);

        UI.showAlert("Sucesso", "Senha alterada!");
        UI.hideModal('change-password-modal');
    } catch (error) { console.error(error); UI.showAlert("Erro", "Falha ao alterar senha."); }
});

document.getElementById('btn-save-base-value').addEventListener('click', async () => {
    const month = document.getElementById('month-ref').value;
    const value = parseFloat(document.getElementById('base-value').value);
    if (!month || isNaN(value)) return UI.showAlert("Erro", "Valor inválido.");
    if (confirm("Deseja realmente ALTERAR o valor base?")) {
        await Services.updateBaseValue(month, value);
        UI.showAlert("Sucesso", "Valor Base salvo!");
    }
});

document.getElementById('btn-delete-base-value')?.addEventListener('click', async () => {
    const month = document.getElementById('month-ref').value;
    if (!month) return;
    if (confirm("Deseja realmente EXCLUIR o valor base?")) {
        try {
            await Services.deleteBaseValue(month);
            document.getElementById('base-value').value = '';
            UI.showAlert("Sucesso", "Excluído.");
        } catch (e) { console.error(e); UI.showAlert("Erro", "Falha ao excluir."); }
    }
});

document.getElementById('master-registration-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const user = document.getElementById('reg-master-username').value;
    const pass = document.getElementById('reg-master-password').value;
    if (pass.length < 6) return alert("Senha curta");
    const hash = await Utils.digestMessage(pass);
    await Services.createMaster(user, hash);
    alert("Master criado!");
    UI.hideModal('master-registration-modal');
});

// --- LISTENERS DE FÉRIAS (QUE TINHAM SUMIDO) ---

document.getElementById('btn-vacation-yes').addEventListener('click', () => {
    State.isVacationInput = true;
    document.getElementById('base-value').value = 0;
    document.getElementById('base-value').readOnly = true; 
    document.getElementById('indices-container').style.opacity = '0.5'; 
    document.getElementById('indices-container').style.pointerEvents = 'none'; 
    
    calculateTotalPreview();
    UI.hideModal('vacation-modal');
    UI.showAlert("Modo Férias", "Valores zerados automaticamente.");
});

document.getElementById('btn-vacation-no').addEventListener('click', () => {
    State.isVacationInput = false;
    const month = document.getElementById('month-ref').value;
    Services.getBaseValue(month).then(val => {
        document.getElementById('base-value').value = val || '';
    });
    
    if (!State.isSupervisor) document.getElementById('base-value').readOnly = false;
    else document.getElementById('base-value').readOnly = true;
    
    document.getElementById('indices-container').style.opacity = '1';
    document.getElementById('indices-container').style.pointerEvents = 'auto';
    
    calculateTotalPreview();
    UI.hideModal('vacation-modal');
});

// --- LANÇAMENTO ---

document.getElementById('employee-select').addEventListener('change', (e) => {
    const empId = e.target.value;
    if(!empId) return;
    
    const exists = State.history.find(h => h.employeeId === empId && h.id !== State.editingLaunchId);
    if (exists) UI.showAlert("Atenção", "Já existe um lançamento.");

    const emp = State.employees.find(x => x.id === empId);
    if(emp) {
        const sec = State.sectors.find(s => s.id === emp.sectorId);
        renderIndicesInputs(sec ? sec.indices : []);
        document.getElementById('vacation-message').textContent = `O colaborador ${emp.name} esteve de férias em ${document.getElementById('month-ref').value}?`;
        UI.showModal('vacation-modal');
    }
});

document.getElementById('launch-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const empId = document.getElementById('employee-select').value;
    const month = document.getElementById('month-ref').value;
    if (!empId || !month) return UI.showAlert("Erro", "Preencha os dados.");

    const exists = State.history.find(h => h.employeeId === empId && h.id !== State.editingLaunchId);
    if (exists) return UI.showAlert("Bloqueio", "Já existe um lançamento.");

    let points = 0;
    const scores = [];
    let total = 0;
    let status = "";
    let base = 0;

    if (State.isVacationInput) {
        status = "FÉRIAS";
        base = 0; total = 0;
    } else {
        document.querySelectorAll('.score-input').forEach(inp => {
            const v = parseFloat(inp.value) || 0;
            points += v;
            scores.push({ name: inp.dataset.name, score: v, max: parseFloat(inp.dataset.max) });
        });
        base = parseFloat(document.getElementById('base-value').value) || 0;
        total = base * (points / 100);
    }

    const data = {
        monthRef: month, employeeId: empId, 
        employeeName: State.employees.find(e=>e.id===empId).name,
        sectorId: State.employees.find(e=>e.id===empId).sectorId,
        launchedBySupervisor: State.supervisorId,
        baseValue: base, totalValue: total, scores: scores, status: status
    };

    await Services.saveLaunch(data, State.editingLaunchId);
    if (State.isSupervisor) {
        const emp = State.employees.find(e=>e.id===empId);
        const supName = State.supervisors.find(s=>s.id===State.supervisorId)?.name;
        await Services.updateSupervisorAvg(month, State.supervisorId, supName, emp.sectorId);
    }
    UI.showAlert("Sucesso", "Salvo!");
    resetLaunchForm();
});

document.getElementById('btn-cancel-edit').addEventListener('click', () => resetLaunchForm());

document.getElementById('report-employee-filter')?.addEventListener('change', async (e) => {
    const id = e.target.value;
    if (!id) return;
    const data = await Services.getChartData(id);
    const labels = data.map(d => { const [y,m] = d.monthRef.split('-'); return `${m}/${y}`; });
    const points = data.map(d => d.totalValue);
    UI.renderChart('evolutionChart', labels, points, data[0]?.employeeName || 'Dados');
});

document.getElementById('btn-download-csv').addEventListener('click', () => {
    Utils.downloadCSV(State.history, `relatorio_${document.getElementById('month-ref').value}.csv`);
});

// FUNÇÕES GLOBAIS
window.editSector = (id) => {
    const s = State.sectors.find(x => x.id === id);
    if(s) {
        document.getElementById('sector-name').value = s.name;
        document.getElementById('edit-sector-id').value = s.id;
        UI.showModal('sector-modal');
    }
};

window.editSupervisor = (id) => {
    const s = State.supervisors.find(x => x.id === id);
    if(s) {
        document.getElementById('supervisor-name').value = s.name;
        document.getElementById('supervisor-username').value = s.username;
        document.getElementById('supervisor-sector').value = s.sectorId;
        document.getElementById('supervisor-password').value = "";
        document.getElementById('edit-supervisor-id').value = s.id;
        const showPass = document.getElementById('show-password');
        if(showPass) showPass.checked = false;
        document.getElementById('supervisor-password').type = 'password';
        UI.showModal('supervisor-modal');
    }
};

window.editEmployee = (id) => {
    const e = State.employees.find(x => x.id === id);
    if(e) {
        document.getElementById('employee-name').value = e.name;
        document.getElementById('employee-sector').value = e.sectorId;
        document.getElementById('edit-employee-id').value = e.id;
        const sel = document.getElementById('employee-sector');
        if (State.isSupervisor) { sel.value = State.supervisorSectorId; sel.disabled = true; }
        else { sel.disabled = false; }
        UI.showModal('employee-modal');
    }
};

window.deleteSector = (id) => { State.itemToDelete = { id: id, type: 'sectors' }; UI.showModal('delete-confirm-modal'); };
window.deleteSupervisor = (id) => { State.itemToDelete = { id: id, type: 'supervisors' }; UI.showModal('delete-confirm-modal'); };
window.deleteEmployee = (id) => { State.itemToDelete = { id: id, type: 'employees' }; UI.showModal('delete-confirm-modal'); };

document.getElementById('btn-confirm-delete').addEventListener('click', async () => {
    if (!State.itemToDelete) return;
    try {
        await Services.deleteItem(State.itemToDelete.type, State.itemToDelete.id);
        if (State.itemToDelete.type === 'launches' && State.itemToDelete.supervisorId) {
             const sup = State.supervisors.find(s => s.id === State.itemToDelete.supervisorId);
             const supName = sup ? sup.name : 'Supervisor';
             await Services.updateSupervisorAvg(State.itemToDelete.month, State.itemToDelete.supervisorId, supName, State.itemToDelete.sectorId);
        }
        UI.showAlert("Sucesso", "Item excluído.");
        if(State.itemToDelete.type === 'employees' && document.getElementById('manage-team-modal').style.display === 'block') {
             const row = document.querySelector(`#manage-team-list button[onclick*="${State.itemToDelete.id}"]`).closest('tr');
             if(row) row.remove();
        }
    } catch (e) { console.error(e); UI.showAlert("Erro", "Falha ao excluir."); }
    UI.hideModal('delete-confirm-modal');
    State.itemToDelete = null;
});

const applyPermissions = () => {
    const adminControls = document.getElementById('admin-controls');
    const els = ['btn-open-supervisor-modal', 'btn-open-sector-modal', 'btn-view-admin'];
    
    if (State.isMaster || State.isSupervisor) adminControls.classList.remove('hidden');
    els.forEach(id => document.getElementById(id)?.classList.toggle('hidden', !State.isMaster));
    document.getElementById('btn-open-employee-modal')?.classList.toggle('hidden', !(State.isMaster || State.isSupervisor));
    
    const isSup = State.isSupervisor;
    document.getElementById('supervisor-launch-fields')?.classList.toggle('hidden', !isSup);
    document.getElementById('sector-filter-container')?.classList.toggle('hidden', isSup);
    document.getElementById('base-value').readOnly = isSup;
    
    document.getElementById('btn-save-base-value')?.classList.toggle('hidden', isSup);
    document.getElementById('btn-delete-base-value')?.classList.toggle('hidden', isSup); 
    
    document.getElementById('btn-manage-sector-indices')?.classList.toggle('hidden', !isSup);
    document.getElementById('btn-manage-team')?.classList.toggle('hidden', !isSup);
};

const loadHistory = () => {
    const month = document.getElementById('month-ref').value;
    const sector = State.isSupervisor ? State.supervisorSectorId : document.getElementById('sector-filter').value;
    
    Services.getBaseValue(month).then(val => {
        document.getElementById('base-value').value = val || '';
    });

    if (State.historyUnsubscribe) {
        State.historyUnsubscribe();
        State.historyUnsubscribe = null;
    }

    State.historyUnsubscribe = Services.subscribeToLaunches(month, sector, State.isSupervisor, (data) => {
        State.history = data.map(d => ({
            ...d, 
            sectorName: State.sectors.find(s => s.id === d.sectorId)?.name || '-'
        }));
        renderHistoryTable();
    });
};

const renderHistoryTable = () => {
    const tbody = document.getElementById('history-table-body');
    tbody.innerHTML = '';
    
    if (!State.history.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-500">Sem dados.</td></tr>';
        return;
    }

    State.history.sort((a, b) => b.createdAt - a.createdAt);

    State.history.forEach(item => {
        const tr = document.createElement('tr');
        const canEdit = State.isSupervisor || State.isMaster;
        
        let statusText = item.status || 'OK';
        let statusClass = "text-gray-600";
        if (statusText === 'OK') statusClass = "text-green-600 font-medium";
        if (statusText === 'FÉRIAS') statusClass = "text-blue-600 font-bold";
        if (statusText === 'MÉDIA') statusClass = "text-purple-600 font-bold";

        let detailsContent = '';
        if (statusText === 'OK' && item.scores && item.scores.length > 0) {
            detailsContent = `<button class="text-red-600 font-bold hover:underline btn-view-details text-xs" data-id="${item.id}">Ver +</button>`;
        } else {
            detailsContent = `<span class="${statusClass} text-xs">${statusText}</span>`;
        }

        const btnAction = item.status === 'MÉDIA' ? '-' : 
            `<button class="text-blue-600 mr-2 btn-edit-launch hover:underline text-xs" data-id="${item.id}">Editar</button>
             <button class="text-red-600 btn-del-launch hover:underline text-xs" data-id="${item.id}">Excluir</button>`;
             
        tr.innerHTML = `
            <td class="px-4 py-3 text-sm text-gray-900">${item.monthRef}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${item.employeeName}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${item.sectorName}</td>
            <td class="px-4 py-3 text-sm text-gray-900">${Utils.formatCurrency(item.baseValue)}</td>
            <td class="px-4 py-3 text-sm font-bold text-gray-900">${Utils.formatCurrency(item.totalValue)}</td>
            <td class="px-4 py-3 text-sm text-gray-500">${Utils.formatDate(item.createdAt)}</td>
            <td class="px-4 py-3 text-center">${detailsContent}</td>
            <td class="px-4 py-3 text-center">${!canEdit ? '' : btnAction}</td>
        `;
        tbody.appendChild(tr);

        if (statusText === 'OK' && item.scores && item.scores.length > 0) {
            const trDetails = document.createElement('tr');
            trDetails.id = `details-${item.id}`;
            trDetails.className = 'hidden bg-gray-50';
            const scoresList = item.scores.map(s => 
                `<li class="flex justify-between items-center py-2 border-b border-gray-200 last:border-0">
                    <span class="text-sm text-gray-600">${s.name}</span> 
                    <span class="text-sm font-semibold text-gray-900">${s.score} <span class="text-xs text-gray-400">/ ${s.max}</span></span>
                 </li>`
            ).join('');
            trDetails.innerHTML = `
                <td colspan="8" class="px-4 sm:px-8 py-3 border-t border-gray-100 shadow-inner bg-gray-50">
                    <div class="max-w-md mx-auto sm:mx-0"> 
                        <p class="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">Pontuação Detalhada</p>
                        <ul class="bg-white rounded border border-gray-200 px-4 list-none shadow-sm">${scoresList}</ul>
                    </div>
                </td>
            `;
            tbody.appendChild(trDetails);
        }
    });
    
    document.querySelectorAll('.btn-edit-launch').forEach(b => b.onclick = () => loadLaunchForEdit(b.dataset.id));
    document.querySelectorAll('.btn-del-launch').forEach(b => b.onclick = () => deleteLaunch(b.dataset.id));
    document.querySelectorAll('.btn-view-details').forEach(b => b.onclick = () => {
        const row = document.getElementById(`details-${b.dataset.id}`);
        if (row) {
            row.classList.toggle('hidden');
            b.textContent = row.classList.contains('hidden') ? 'Ver +' : 'Ocultar';
        }
    });
};

const populateSectorSelects = () => {
    const currentFilter = document.getElementById('sector-filter').value;
    const opts = '<option value="">-- Selecione --</option>' + State.sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    ['supervisor-sector', 'employee-sector'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = opts;
    });
    const filterEl = document.getElementById('sector-filter');
    filterEl.innerHTML = '<option value="all">Todos os Setores</option>' + State.sectors.map(s => `<option value="${s.id}">${s.name}</option>`).join('');
    if (currentFilter && currentFilter !== 'all') filterEl.value = currentFilter;
};

const populateEmployeeSelect = () => {
    const el = document.getElementById('employee-select');
    if(el) el.innerHTML = '<option value="">-- Selecione --</option>' + State.employees.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
};

const populateReportFilter = () => {
    const el = document.getElementById('report-employee-filter');
    if(!el) return;
    let html = '<option value="">-- Selecione --</option>';
    if(State.supervisors.length > 0) {
        html += '<optgroup label="Médias de Gestão">';
        State.supervisors.forEach(s => {
            if (State.isMaster || (State.isSupervisor && s.id === State.supervisorId)) {
                html += `<option value="avg_${s.id}">Média - ${s.name}</option>`;
            }
        });
        html += '</optgroup>';
    }
    html += '<optgroup label="Colaboradores">';
    State.employees.forEach(e => {
        html += `<option value="${e.id}">${e.name}</option>`;
    });
    html += '</optgroup>';
    el.innerHTML = html;
};

const renderSectorsTable = () => {
    const tbody = document.getElementById('sectors-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!State.sectors || State.sectors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-500">Nenhum setor cadastrado.</td></tr>';
        return;
    }
    tbody.innerHTML = State.sectors.map(s => 
        `<tr>
            <td class="px-4 py-2 text-sm text-gray-900">${s.name}</td>
            <td class="px-4 py-2 text-sm text-gray-500">${(s.indices||[]).length} Metas</td>
            <td class="px-4 py-2">
                <button class="text-blue-600 mr-2 hover:underline text-sm" onclick="editSector('${s.id}')">Editar</button>
                <button class="text-red-600 hover:underline text-sm" onclick="deleteSector('${s.id}')">Excluir</button>
            </td>
        </tr>`
    ).join('');
};

const renderSupervisorsTable = () => {
    const tbody = document.getElementById('supervisors-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!State.supervisors || State.supervisors.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-4 text-center text-gray-500">Nenhum supervisor.</td></tr>';
        return;
    }
    tbody.innerHTML = State.supervisors.map(s => {
        const sName = State.sectors.find(sec => sec.id === s.sectorId)?.name || '-';
        return `<tr>
            <td class="px-4 py-2 text-sm text-gray-900">${s.name}</td>
            <td class="px-4 py-2 text-sm text-gray-500">${s.username}</td>
            <td class="px-4 py-2 text-sm text-gray-500">${sName}</td>
            <td class="px-4 py-2">
                <button class="text-blue-600 mr-2 hover:underline text-sm" onclick="editSupervisor('${s.id}')">Editar</button>
                <button class="text-red-600 hover:underline text-sm" onclick="deleteSupervisor('${s.id}')">Excluir</button>
            </td>
        </tr>`;
    }).join('');
};

const renderEmployeesTable = () => {
    const tbody = document.getElementById('employees-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';
    if (!State.employees || State.employees.length === 0) {
        tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-4 text-center text-gray-500">Nenhum colaborador.</td></tr>';
        return;
    }
    tbody.innerHTML = State.employees.map(e => {
        const sName = State.sectors.find(sec => sec.id === e.sectorId)?.name || '-';
        return `<tr>
            <td class="px-4 py-2 text-sm text-gray-900">${e.name}</td>
            <td class="px-4 py-2 text-sm text-gray-500">${sName}</td>
            <td class="px-4 py-2">
                <button class="text-blue-600 mr-2 hover:underline text-sm" onclick="editEmployee('${e.id}')">Editar</button>
                <button class="text-red-600 hover:underline text-sm" onclick="deleteEmployee('${e.id}')">Excluir</button>
            </td>
        </tr>`;
    }).join('');
};

document.getElementById('month-ref').addEventListener('change', loadHistory);
document.getElementById('sector-filter').addEventListener('change', loadHistory);

const setDefaultMonth = () => {
    const now = new Date();
    document.getElementById('month-ref').value = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
};

init();