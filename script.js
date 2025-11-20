
        import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
        import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
        // CORREÇÃO: Adicionado deleteField aos imports
        import { getFirestore, doc, getDoc, addDoc, setDoc, updateDoc, deleteDoc, deleteField, onSnapshot, collection, query, where, getDocs, writeBatch, serverTimestamp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

        const firebaseConfig = {
            apiKey: "AIzaSyCUf800FNv--emagtwh5YevSPqFtk7Miiw",
            authDomain: "remuneracao-equipe.firebaseapp.com",
            projectId: "remuneracao-equipe",
            storageBucket: "remuneracao-equipe.firebasestorage.app",
            messagingSenderId: "1070188778724",
            appId: "1:1070188778724:web:684e19b2259a99b17288f1"
        };
        
        const appId = 'remuneracao';
        let db, auth;
        let currentUserId = null; 
        let currentSupervisorId = null; 
        let currentSupervisorSectorId = null;
        let isMaster = false;
        let isSupervisor = false;
        let isRhUser = false;
        let currentEditingLaunchId = null; 
        let globalSectors = [];
        let globalEmployees = [];
        let globalSupervisors = [];
        let globalHistory = []; 
        let currentHistorySort = { column: 'createdAt', direction: 'desc' };
        let evolutionChart = null; 
        
        // Listener handlers
        let historyUnsubscribe = null;
        let employeesUnsubscribe = null;
        
        async function digestMessage(message) {
            if (window.crypto && window.crypto.subtle) {
                try {
                    const msgUint8 = new TextEncoder().encode(message);
                    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
                    const hashArray = Array.from(new Uint8Array(hashBuffer));
                    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
                } catch (e) { return simpleHashFallback(message); }
            } else { return simpleHashFallback(message); }
        }

        function simpleHashFallback(str) {
            let hash = 0;
            if (str.length === 0) return hash.toString();
            for (let i = 0; i < str.length; i++) {
                const char = str.charCodeAt(i);
                hash = ((hash << 5) - hash) + char;
                hash |= 0;
            }
            return "local_" + hash.toString(16);
        }

        // DOM Elements
        const loginScreen = document.getElementById('login-screen');
        const appContent = document.getElementById('app-content');
        const loginForm = document.getElementById('login-form');
        const loginUsername = document.getElementById('login-username');
        const loginPassword = document.getElementById('login-password');
        const loginError = document.getElementById('login-error');
        const btnLogout = document.getElementById('btn-logout');
        
        const masterRegisterContainer = document.getElementById('master-register-container');
        const btnRegisterMaster = document.getElementById('btn-register-master');
        const masterRegistrationModal = document.getElementById('master-registration-modal');
        const masterRegistrationForm = document.getElementById('master-registration-form');
        const regMasterUsername = document.getElementById('reg-master-username');
        const regMasterPassword = document.getElementById('reg-master-password');
        const regMasterConfirm = document.getElementById('reg-master-confirm');
        const cancelMasterReg = document.getElementById('cancel-master-reg');
        const closeMasterReg = document.getElementById('close-master-reg');

        const userIdLog = document.getElementById('user-id-log');
        const currentUserIdDisplay = document.getElementById('current-user-id-display');
        const adminControls = document.getElementById('admin-controls');
        
        const btnViewLaunch = document.getElementById('btn-view-launch');
        const btnViewAdmin = document.getElementById('btn-view-admin');
        const btnViewReports = document.getElementById('btn-view-reports');
        const btnChangePassword = document.getElementById('btn-change-password'); // NOVO
        const viewLaunch = document.getElementById('view-launch');
        const viewAdmin = document.getElementById('view-admin');
        const viewReports = document.getElementById('view-reports');
        const reportEmployeeFilter = document.getElementById('report-employee-filter');

        const btnOpenSupervisorModal = document.getElementById('btn-open-supervisor-modal');
        const btnOpenSectorModal = document.getElementById('btn-open-sector-modal');
        const btnOpenEmployeeModal = document.getElementById('btn-open-employee-modal');
        const btnManageSectorIndices = document.getElementById('btn-manage-sector-indices');

        const launchForm = document.getElementById('launch-form');
        const monthRefInput = document.getElementById('month-ref');
        const sectorFilterContainer = document.getElementById('sector-filter-container');
        const sectorFilterSelect = document.getElementById('sector-filter');
        const baseValueInput = document.getElementById('base-value');
        const btnSaveBaseValue = document.getElementById('btn-save-base-value');
        const baseValueLoading = document.getElementById('base-value-loading');
        
        const supervisorLaunchFields = document.getElementById('supervisor-launch-fields');
        const employeeSelect = document.getElementById('employee-select');
        const indicesContainer = document.getElementById('indices-container');
        const totalCalculated = document.getElementById('total-calculated');
        const btnSubmitLaunch = document.getElementById('btn-submit-launch');
        const btnCancelEdit = document.getElementById('btn-cancel-edit');

        const historyTable = document.getElementById('historyTable');
        const historyTableBody = document.getElementById('history-table-body');
        const historyLoading = document.getElementById('history-loading');
        const btnDownloadCSV = document.getElementById('btn-download-csv');
        
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabContents = document.querySelectorAll('.tab-content');

        const supervisorsTableBody = document.getElementById('supervisors-table-body');
        const sectorsTableBody = document.getElementById('sectors-table-body');
        const employeesTableBody = document.getElementById('employees-table-body');

        // Modais de Cadastro
        const supervisorModal = document.getElementById('supervisor-modal');
        const supervisorForm = document.getElementById('supervisor-form');
        const supervisorModalTitle = document.getElementById('supervisor-modal-title');
        const editSupervisorId = document.getElementById('edit-supervisor-id');
        const supervisorName = document.getElementById('supervisor-name');
        const supervisorSector = document.getElementById('supervisor-sector');
        const supervisorUsername = document.getElementById('supervisor-username');
        const supervisorPassword = document.getElementById('supervisor-password');
        const showPassword = document.getElementById('show-password');
        const closeSupervisorModal = document.getElementById('close-supervisor-modal');
        const cancelSupervisorModal = document.getElementById('cancel-supervisor-modal');
        
        const sectorModal = document.getElementById('sector-modal');
        const sectorForm = document.getElementById('sector-form');
        const sectorModalTitle = document.getElementById('sector-modal-title');
        const editSectorId = document.getElementById('edit-sector-id');
        const sectorName = document.getElementById('sector-name');
        const closeSectorModal = document.getElementById('close-sector-modal');
        const cancelSectorModal = document.getElementById('cancel-sector-modal');
        const btnSubmitSectorForm = document.getElementById('btn-submit-sector-form');

        const sectorIndicesModal = document.getElementById('sector-indices-modal');
        const sectorIndicesForm = document.getElementById('sector-indices-form');
        const editIndicesSectorId = document.getElementById('edit-indices-sector-id');
        const sectorIndicesName = document.getElementById('sector-indices-name');
        const indicesList = document.getElementById('indices-list');
        const addIndexField = document.getElementById('add-index-field');
        const indicesTotalPercentage = document.getElementById('indices-total-percentage');
        const btnSubmitIndicesForm = document.getElementById('btn-submit-indices-form');
        const closeSectorIndicesModal = document.getElementById('close-sector-indices-modal');
        const cancelSectorIndicesModal = document.getElementById('cancel-sector-indices-modal');

        const employeeModal = document.getElementById('employee-modal');
        const employeeForm = document.getElementById('employee-form');
        const employeeModalTitle = document.getElementById('employee-modal-title');
        const editEmployeeId = document.getElementById('edit-employee-id');
        const employeeName = document.getElementById('employee-name');
        const employeeSector = document.getElementById('employee-sector');
        const closeEmployeeModal = document.getElementById('close-employee-modal');
        const cancelEmployeeModal = document.getElementById('cancel-employee-modal');

        // Modal Troca Senha
        const changePasswordModal = document.getElementById('change-password-modal');
        const changePasswordForm = document.getElementById('change-password-form');
        const cpOldPassword = document.getElementById('cp-old-password');
        const cpNewPassword = document.getElementById('cp-new-password');
        const cpConfirmPassword = document.getElementById('cp-confirm-password');
        const closeChangePassModal = document.getElementById('close-change-pass-modal');
        const cancelChangePass = document.getElementById('cancel-change-pass');

        const deleteConfirmModal = document.getElementById('delete-confirm-modal');
        const deleteConfirmMessage = document.getElementById('delete-confirm-message');
        const btnCancelDelete = document.getElementById('btn-cancel-delete');
        const btnConfirmDelete = document.getElementById('btn-confirm-delete');
        
        const alertModal = document.getElementById('alert-modal');
        const alertTitle = document.getElementById('alert-title');
        const alertMessage = document.getElementById('alert-message');
        const btnCloseAlert = document.getElementById('btn-close-alert');

        const vacationModal = document.getElementById('vacation-modal');
        const vacationMessage = document.getElementById('vacation-message');
        const btnVacationNo = document.getElementById('btn-vacation-no');
        const btnVacationYes = document.getElementById('btn-vacation-yes');
        let vacationEmployee = null; 

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                tabButtons.forEach(btn => btn.classList.remove('active'));
                button.classList.add('active');
                tabContents.forEach(content => content.classList.remove('active'));
                const tabId = button.getAttribute('data-tab');
                const contentToShow = document.getElementById(`tab-${tabId}`);
                if (contentToShow) contentToShow.classList.add('active');
                if (tabId === 'supervisors') renderSupervisorsTable();
                if (tabId === 'sectors') renderSectorsTable();
                if (tabId === 'employees') renderEmployeesTable();
            });
        });

        const getBasePath = () => doc(db, 'artifacts', appId);
        const getSupervisorsCollection = () => collection(getBasePath(), 'supervisors');
        const getSectorsCollection = () => collection(getBasePath(), 'sectors');
        const getEmployeesCollection = () => collection(getBasePath(), 'employees');
        const getLaunchesCollection = () => collection(getBasePath(), 'launches');
        const getBaseValuesCollection = () => collection(getBasePath(), 'baseValues');
        const getMasterConfigDoc = () => doc(db, 'artifacts', appId, 'system', 'master');

        const showModal = (el) => { if (el) el.style.display = 'block'; };
        const hideModal = (el) => { if (el) el.style.display = 'none'; };
        const showMessage = (title, message) => {
            if(alertTitle) alertTitle.textContent = title;
            if(alertMessage) alertMessage.textContent = message;
            showModal(alertModal);
        };
        
        if(btnCloseAlert) btnCloseAlert.addEventListener('click', () => hideModal(alertModal));

        const closeButtons = [
            closeSupervisorModal, closeSectorModal, closeSectorIndicesModal, closeEmployeeModal, closeMasterReg, closeChangePassModal
        ];
        closeButtons.forEach(btn => {
            if (btn) btn.addEventListener('click', () => { const modal = btn.closest('.modal'); if (modal) hideModal(modal); });
        });

        window.onclick = (event) => {
            if (event.target.classList.contains('modal')) hideModal(event.target);
        };

        const switchView = (viewName) => {
            btnViewLaunch.classList.replace('text-red-600', 'text-gray-600');
            btnViewAdmin.classList.replace('text-red-600', 'text-gray-600');
            btnViewReports.classList.replace('text-red-600', 'text-gray-600');

            viewLaunch.style.display = 'none';
            viewAdmin.style.display = 'none';
            viewReports.style.display = 'none';

            if (viewName === 'admin') {
                viewAdmin.style.display = 'block';
                btnViewAdmin.classList.replace('text-gray-600', 'text-red-600');
                renderSupervisorsTable();
            } else if (viewName === 'reports') {
                viewReports.style.display = 'block';
                btnViewReports.classList.replace('text-gray-600', 'text-red-600');
                populateReportEmployeeFilter(); 
            } else { 
                viewLaunch.style.display = 'grid';
                btnViewLaunch.classList.replace('text-gray-600', 'text-red-600');
            }
        };

        if(btnViewLaunch) btnViewLaunch.addEventListener('click', () => switchView('launch'));
        if(btnViewAdmin) btnViewAdmin.addEventListener('click', () => switchView('admin'));
        if(btnViewReports) btnViewReports.addEventListener('click', () => switchView('reports'));
        
        // Lógica para Trocar Senha
        if(btnChangePassword) btnChangePassword.addEventListener('click', () => {
            if(changePasswordForm) changePasswordForm.reset();
            showModal(changePasswordModal);
        });

        if(cancelChangePass) cancelChangePass.addEventListener('click', () => hideModal(changePasswordModal));

        if(changePasswordForm) changePasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const oldPass = cpOldPassword.value;
            const newPass = cpNewPassword.value;
            const confPass = cpConfirmPassword.value;

            if (newPass !== confPass) return alert("As novas senhas não coincidem.");
            
            // CORREÇÃO: Regex mais flexível para caracteres especiais (permite qualquer simbolo)
            // Mínimo 6 chars, 1 maiúscula, 1 minúscula, 1 número, 1 especial (qualquer simbolo)
            const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[\W_]).{6,}$/;
            
            if (!passwordRegex.test(newPass)) {
                return alert("A nova senha deve ter:\n- Mínimo 6 caracteres\n- Pelo menos 1 Letra Maiúscula\n- Pelo menos 1 Letra Minúscula\n- Pelo menos 1 Número\n- Pelo menos 1 Caractere especial (ex: @, #, ., -, etc)");
            }

            try {
                const oldHash = await digestMessage(oldPass);
                const newHash = await digestMessage(newPass);

                // Verificar qual coleção atualizar
                let userRef;
                let validOldPass = false;

                if (isMaster) {
                    userRef = getMasterConfigDoc();
                    const docSnap = await getDoc(userRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        if (data.passwordHash === oldHash || data.password === oldPass) validOldPass = true;
                    }
                } else if (isSupervisor && currentSupervisorId) {
                    userRef = doc(getSupervisorsCollection(), currentSupervisorId);
                    const docSnap = await getDoc(userRef);
                    if (docSnap.exists()) {
                        const data = docSnap.data();
                        // CORREÇÃO: Verifica tanto o hash quanto a senha plana (legado)
                        if (data.passwordHash === oldHash || data.password === oldPass) validOldPass = true;
                    }
                }

                if (!validOldPass) return alert("Senha atual incorreta.");

                // Atualiza para o novo hash e remove o campo de senha plana se existir (segurança)
                await updateDoc(userRef, { passwordHash: newHash, password: deleteField() });
                
                alert("Senha alterada com sucesso!");
                hideModal(changePasswordModal);
            } catch (error) {
                console.error("Erro ao trocar senha:", error);
                alert("Erro técnico ao alterar senha. Veja o console para detalhes.");
            }
        });

        if(monthRefInput) {
            monthRefInput.addEventListener('change', () => {
                loadBaseValue();
                loadHistory();
            });
        }

        if(sectorFilterSelect) {
            sectorFilterSelect.addEventListener('change', () => {
                loadHistory();
            });
        }

        if(reportEmployeeFilter) {
            reportEmployeeFilter.addEventListener('change', () => {
                loadAndRenderChart();
            });
        }

        const setDefaultMonth = () => {
            const now = new Date();
            const year = now.getFullYear();
            const month = (now.getMonth() + 1).toString().padStart(2, '0');
            if(monthRefInput) monthRefInput.value = `${year}-${month}`;
        };

        const startFirebase = async () => {
            if (!firebaseConfig || !firebaseConfig.apiKey || firebaseConfig.apiKey.includes("COLE_SUA_API_KEY_AQUI")) {
                loginError.textContent = "Erro Crítico: Configuração do Firebase ausente.";
                loginError.classList.remove('hidden');
                return;
            }
            try {
                const app = initializeApp(firebaseConfig);
                db = getFirestore(app);
                auth = getAuth(app);
                await signInAnonymously(auth);

                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        currentUserId = user.uid;
                        if(currentUserIdDisplay) currentUserIdDisplay.textContent = currentUserId;
                        checkMasterRegistration();
                    } else {
                        currentUserId = null;
                    }
                });
            } catch (error) {
                loginError.textContent = `Erro de Conexão: ${error.message}`;
                loginError.classList.remove('hidden');
            }
        };
        
        const checkMasterRegistration = async () => {
             try {
                const docRef = getMasterConfigDoc();
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    if(masterRegisterContainer) masterRegisterContainer.classList.add('hidden');
                } else {
                    if(masterRegisterContainer) masterRegisterContainer.classList.remove('hidden');
                }
             } catch (error) {
                 console.error("Erro check master:", error);
             }
        };
        
        if(btnRegisterMaster) btnRegisterMaster.addEventListener('click', (e) => {
            e.preventDefault();
            if(masterRegistrationForm) masterRegistrationForm.reset();
            showModal(masterRegistrationModal);
        });
        
        if(cancelMasterReg) cancelMasterReg.addEventListener('click', () => hideModal(masterRegistrationModal));
        
        if(masterRegistrationForm) masterRegistrationForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = regMasterUsername.value.trim();
            const password = regMasterPassword.value;
            const confirm = regMasterConfirm.value;
            
            if (password !== confirm) return alert("Senhas não coincidem.");
            if (password.length < 6) return alert("Senha muito curta.");
            
            try {
                const passwordHash = await digestMessage(password);
                const docRef = getMasterConfigDoc();
                await setDoc(docRef, { username: username, passwordHash: passwordHash, createdAt: serverTimestamp() });
                alert("Master cadastrado! Faça login.");
                hideModal(masterRegistrationModal);
                checkMasterRegistration();
            } catch (error) {
                console.error(error);
                alert("Erro ao cadastrar.");
            }
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const username = loginUsername.value.trim();
            const password = loginPassword.value;
            const passwordHash = await digestMessage(password);
            let loggedIn = false;

            try {
                const masterDocRef = getMasterConfigDoc();
                const masterDocSnap = await getDoc(masterDocRef);
                if (masterDocSnap.exists()) {
                    const masterData = masterDocSnap.data();
                    if (masterData.username === username && masterData.passwordHash === passwordHash) {
                        isMaster = true; isSupervisor = false; isRhUser = false;
                        currentSupervisorId = 'master'; loggedIn = true;
                    }
                } 
            } catch (error) { console.error(error); }
            
            if (!loggedIn) {
                try {
                    let q = query(getSupervisorsCollection(), where("username", "==", username), where("passwordHash", "==", passwordHash));
                    let querySnapshot = await getDocs(q);
                    
                    if (querySnapshot.empty) { 
                         q = query(getSupervisorsCollection(), where("username", "==", username), where("password", "==", password));
                         querySnapshot = await getDocs(q);
                         if (!querySnapshot.empty) alert("Atenção: Atualize sua senha para segurança.");
                    }
                    
                    if (!querySnapshot.empty) {
                        const supervisorDoc = querySnapshot.docs[0];
                        const supervisorData = supervisorDoc.data();
                        isMaster = false; isSupervisor = true;
                        currentSupervisorId = supervisorDoc.id;
                        currentSupervisorSectorId = supervisorData.sectorId;
                        
                        const sectorDoc = await getDoc(doc(getSectorsCollection(), currentSupervisorSectorId));
                        if (sectorDoc.exists() && sectorDoc.data().name.toUpperCase() === 'RH') {
                            isRhUser = true; isSupervisor = false;
                        } else { isRhUser = false; }
                        loggedIn = true;
                    }
                } catch (error) { console.error(error); }
            }

            if (loggedIn) {
                loginScreen.classList.add('hidden');
                appContent.classList.remove('hidden');
                switchView('launch'); 
                setDefaultMonth();
                loadAllData();
                applyPermissions();
            } else {
                loginError.textContent = "Usuário ou senha inválidos.";
                loginError.classList.remove('hidden');
            }
        });

        if(btnLogout) btnLogout.addEventListener('click', () => {
            isMaster = false; isSupervisor = false; isRhUser = false;
            currentSupervisorId = null; currentSupervisorSectorId = null;
            loginUsername.value = ''; loginPassword.value = '';
            loginError.classList.add('hidden');
            appContent.classList.add('hidden');
            loginScreen.classList.remove('hidden');
            switchView('launch'); 
            
            // Cleanup listeners
            if(historyUnsubscribe) historyUnsubscribe();
            if(employeesUnsubscribe) employeesUnsubscribe();
        });

        const applyPermissions = () => {
            if (adminControls) {
                if (isMaster || isSupervisor || isRhUser) adminControls.classList.remove('hidden');
                else adminControls.classList.add('hidden');
            }
            const masterEls = [btnOpenSupervisorModal, btnOpenSectorModal, btnViewAdmin];
            masterEls.forEach(el => { if (el) isMaster ? el.classList.remove('hidden') : el.classList.add('hidden'); });
            
            if (btnOpenEmployeeModal) isMaster || isSupervisor ? btnOpenEmployeeModal.classList.remove('hidden') : btnOpenEmployeeModal.classList.add('hidden');
            if (btnManageSectorIndices) isSupervisor ? btnManageSectorIndices.classList.remove('hidden') : btnManageSectorIndices.classList.add('hidden');

            if (isMaster || isRhUser) {
                if(supervisorLaunchFields) supervisorLaunchFields.classList.add('hidden');
                if(sectorFilterContainer) sectorFilterContainer.classList.remove('hidden');
                if (baseValueInput) baseValueInput.readOnly = !isMaster;
                if (btnSaveBaseValue) isMaster ? btnSaveBaseValue.classList.remove('hidden') : btnSaveBaseValue.classList.add('hidden');
            } else if (isSupervisor) {
                if(supervisorLaunchFields) supervisorLaunchFields.classList.remove('hidden');
                if(sectorFilterContainer) sectorFilterContainer.classList.add('hidden');
                if (baseValueInput) baseValueInput.readOnly = true;
                if(btnSaveBaseValue) btnSaveBaseValue.classList.add('hidden');
            }
            const actionCells = document.querySelectorAll('#history-action-header, [data-cell-type="action"]');
            actionCells.forEach(cell => { if (cell) (isMaster || isRhUser) ? cell.classList.add('hidden') : cell.classList.remove('hidden'); });
        };

        const loadAllData = () => {
            onSnapshot(query(getSectorsCollection()), (snapshot) => {
                globalSectors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                populateSectorSelects(globalSectors);
                loadEmployees();
                loadHistory();
                renderSectorsTable();
            }, () => applyPermissions());
            
            onSnapshot(query(getSupervisorsCollection()), (snapshot) => {
                globalSupervisors = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if (viewAdmin.style.display === 'block') renderSupervisorsTable();
            });
            loadBaseValue();
        };

        const populateSectorSelects = (sectors) => {
            [supervisorSector, employeeSector, sectorFilterSelect].forEach(select => {
                if (!select) return;
                const currentValue = select.value;
                select.innerHTML = (select.id === 'sector-filter') ? '<option value="all">Todos os Setores</option>' : '<option value="">-- Selecione um setor --</option>';
                sectors.forEach(sector => {
                    const option = document.createElement('option');
                    option.value = sector.id;
                    option.textContent = sector.name;
                    select.appendChild(option);
                });
                select.value = currentValue;
            });
        };

        const loadEmployees = () => {
            if (employeesUnsubscribe) {
                employeesUnsubscribe();
                employeesUnsubscribe = null;
            }
            let q = isSupervisor ? query(getEmployeesCollection(), where("sectorId", "==", currentSupervisorSectorId)) : query(getEmployeesCollection());
            employeesUnsubscribe = onSnapshot(q, (snapshot) => {
                globalEmployees = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                if(employeeSelect) {
                    employeeSelect.innerHTML = '<option value="">-- Selecione um colaborador --</option>';
                    globalEmployees.forEach(emp => {
                        const option = document.createElement('option');
                        option.value = emp.id;
                        option.textContent = emp.name;
                        employeeSelect.appendChild(option);
                    });
                }
                renderEmployeesTable();
            });
        };

        const loadBaseValue = async () => {
            const month = monthRefInput.value;
            if (!month) { if(baseValueInput) baseValueInput.value = ''; return; }
            if(baseValueLoading) baseValueLoading.classList.remove('hidden');
            try {
                const docSnap = await getDoc(doc(getBaseValuesCollection(), month));
                if (docSnap.exists()) baseValueInput.value = docSnap.data().value;
                else baseValueInput.value = '';
            } catch (e) { baseValueInput.value = ''; }
            finally { if(baseValueLoading) baseValueLoading.classList.add('hidden'); baseValueInput.classList.remove('hidden'); }
        };
        
        if(btnSaveBaseValue) btnSaveBaseValue.addEventListener('click', async () => {
            const month = monthRefInput.value;
            const value = parseFloat(baseValueInput.value);
            if (!month || isNaN(value)) return showMessage("Erro", "Dados inválidos.");
            try {
                await setDoc(doc(getBaseValuesCollection(), month), { value: value });
                showMessage("Sucesso", "Valor base salvo.");
            } catch (e) { showMessage("Erro", "Erro ao salvar."); }
        });


        const loadHistory = () => {
            const month = monthRefInput.value;
            const sectorFilter = sectorFilterSelect.value;
            
            if (historyUnsubscribe) {
                historyUnsubscribe();
                historyUnsubscribe = null;
            }

            if (!month) {
                 if(historyLoading) historyLoading.classList.remove('hidden');
                 return;
            }
            let q;
            if (isSupervisor) {
                q = query(getLaunchesCollection(), where("monthRef", "==", month), where("sectorId", "==", currentSupervisorSectorId));
            } else {
                q = sectorFilter === 'all' ? query(getLaunchesCollection(), where("monthRef", "==", month)) : query(getLaunchesCollection(), where("monthRef", "==", month), where("sectorId", "==", sectorFilter));
            }
            
            historyUnsubscribe = onSnapshot(q, (snapshot) => {
                globalHistory = [];
                snapshot.docs.forEach(doc => {
                    const data = doc.data();
                    const sector = globalSectors.find(s => s.id === data.sectorId);
                    globalHistory.push({ id: doc.id, ...data, sectorName: sector ? sector.name : 'Desconhecido', createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : new Date(0) });
                });
                renderHistoryTable();
            }, () => { globalHistory = []; renderHistoryTable(); });
        };
        
        const renderHistoryTable = () => {
            if(historyTableBody) historyTableBody.innerHTML = ''; 
            if (globalHistory.length === 0) {
                if(historyTableBody) historyTableBody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-500">Nenhum lançamento.</td></tr>';
                if(historyLoading) historyLoading.classList.add('hidden');
                return;
            }
            if(historyLoading) historyLoading.classList.add('hidden');
            const sorted = [...globalHistory].sort((a, b) => {
                const col = currentHistorySort.column;
                const dir = currentHistorySort.direction === 'asc' ? 1 : -1;
                let valA = a[col] || '', valB = b[col] || '';
                if (col === 'totalValue' || col === 'baseValue' || col === 'createdAt') return (valA - valB) * dir;
                return valA.toString().localeCompare(valB.toString()) * dir;
            });
            sorted.forEach(launch => {
                const tr = document.createElement('tr');
                const baseVal = `R$ ${launch.baseValue.toFixed(2).replace('.', ',')}`;
                const totalVal = `R$ ${launch.totalValue.toFixed(2).replace('.', ',')}`;
                const date = launch.createdAt instanceof Date ? launch.createdAt.toLocaleString('pt-BR') : '-';
                
                let actionHtml = launch.status === 'MÉDIA' ? '---' : `<button class="text-blue-600 mr-3" data-edit-id="${launch.id}">Editar</button><button class="text-red-600" data-delete-id="${launch.id}" data-month="${launch.monthRef}" data-supervisor="${launch.launchedBySupervisor}" data-sector="${launch.sectorId}">Excluir</button>`;
                
                let statusClass = launch.status === 'FÉRIAS' ? 'text-blue-600' : (launch.status === 'MÉDIA' ? 'text-green-600' : 'text-red-600');
                let detailsHtml = (launch.status === 'FÉRIAS' || launch.status === 'MÉDIA') ? `<span class="${statusClass}">${launch.status}</span>` : `<button class="text-red-600" data-launch-id="${launch.id}">Ver +</button>`;
                
                tr.innerHTML = `<td class="px-4 py-3">${launch.monthRef}</td><td class="px-4 py-3">${launch.employeeName}</td><td class="px-4 py-3">${launch.sectorName}</td><td class="px-4 py-3">${baseVal}</td><td class="px-4 py-3 font-bold ${statusClass}">${totalVal}</td><td class="px-4 py-3 text-sm">${date}</td><td class="px-4 py-3">${detailsHtml}</td><td class="px-4 py-3" data-cell-type="action">${actionHtml}</td>`;
                const trDetails = document.createElement('tr');
                trDetails.id = `details-${launch.id}`;
                trDetails.classList.add('hidden', 'bg-gray-50');
                trDetails.innerHTML = `<td colspan="8" class="px-8 py-4"><ul class="list-disc list-inside">${launch.scores ? launch.scores.map(s => `<li>${s.name}: ${s.score}/${s.max}</li>`).join('') : ''}</ul></td>`;
                historyTableBody.appendChild(tr);
                historyTableBody.appendChild(trDetails);
            });
            applyPermissions();
        };

        // --- CHART LOGIC ---
        
        // Popula o seletor de filtro do relatório com "Médias de Supervisores" e "Colaboradores"
        const populateReportEmployeeFilter = () => {
            if(!reportEmployeeFilter) return;
            reportEmployeeFilter.innerHTML = '<option value="">-- Selecione para visualizar --</option>';
            
            // Group 1: Supervisores (Médias)
            const groupSupervisors = document.createElement('optgroup');
            groupSupervisors.label = "Médias de Gestão";
            let hasSupervisors = false;

            if (isMaster) {
                globalSupervisors.forEach(sup => {
                    const opt = document.createElement('option');
                    opt.value = `avg_${sup.id}`; // ID padrão das médias
                    opt.textContent = `Média - ${sup.name}`;
                    groupSupervisors.appendChild(opt);
                    hasSupervisors = true;
                });
            } else if (isSupervisor && currentSupervisorId) {
                const me = globalSupervisors.find(s => s.id === currentSupervisorId);
                if(me) {
                    const opt = document.createElement('option');
                    opt.value = `avg_${me.id}`;
                    opt.textContent = `Minha Média (${me.name})`;
                    groupSupervisors.appendChild(opt);
                    hasSupervisors = true;
                }
            }
            if(hasSupervisors) reportEmployeeFilter.appendChild(groupSupervisors);

            // Group 2: Colaboradores Individuais
            const groupEmployees = document.createElement('optgroup');
            groupEmployees.label = "Colaboradores";
            
            let relevantEmployees = [];
            if(isMaster) {
                relevantEmployees = globalEmployees;
            } else if (isSupervisor) {
                relevantEmployees = globalEmployees.filter(e => e.sectorId === currentSupervisorSectorId);
            }

            // Ordenar por nome
            relevantEmployees.sort((a,b) => a.name.localeCompare(b.name));

            relevantEmployees.forEach(emp => {
                const opt = document.createElement('option');
                opt.value = emp.id;
                opt.textContent = emp.name;
                groupEmployees.appendChild(opt);
            });
            reportEmployeeFilter.appendChild(groupEmployees);
        };

        const loadAndRenderChart = async () => {
            const employeeId = reportEmployeeFilter.value;
            
            // Se não tiver funcionário selecionado, limpar gráfico
            if (!employeeId) {
                if (evolutionChart) {
                    evolutionChart.data.labels = [];
                    evolutionChart.data.datasets = [];
                    evolutionChart.update();
                }
                return;
            }

            // Query específica para o funcionário selecionado (seja supervisor ou colaborador)
            const q = query(getLaunchesCollection(), where('employeeId', '==', employeeId));

            try {
                const snapshot = await getDocs(q);
                const rawData = [];
                snapshot.forEach(doc => rawData.push(doc.data()));

                // Ordenar por mês
                rawData.sort((a, b) => a.monthRef.localeCompare(b.monthRef));

                const labels = rawData.map(d => {
                    const [y, m] = d.monthRef.split('-');
                    return `${m}/${y}`;
                });
                
                const dataPoints = rawData.map(d => d.totalValue);
                
                // Nome para o dataset
                const datasetLabel = rawData.length > 0 ? rawData[0].employeeName : "Sem dados";

                // Configuração do Gráfico de Área
                const ctx = document.getElementById('evolutionChart').getContext('2d');
                
                if (evolutionChart) {
                    evolutionChart.destroy();
                }
                
                // Gradiente para o fundo (efeito visual bonito)
                const gradient = ctx.createLinearGradient(0, 0, 0, 400);
                gradient.addColorStop(0, 'rgba(220, 38, 38, 0.5)'); // Red-600 com opacidade
                gradient.addColorStop(1, 'rgba(220, 38, 38, 0.0)');

                evolutionChart = new Chart(ctx, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: datasetLabel,
                            data: dataPoints,
                            borderColor: '#dc2626', // Tailwind red-600
                            backgroundColor: gradient, // Preenchimento com gradiente
                            fill: true, // Ativa o gráfico de área
                            tension: 0.4, // Curvas suaves (estilo da foto)
                            pointBackgroundColor: '#ffffff',
                            pointBorderColor: '#dc2626',
                            pointBorderWidth: 2,
                            pointRadius: 4,
                            pointHoverRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: { font: { family: "'Inter', sans-serif", size: 12 } }
                            },
                            tooltip: {
                                mode: 'index',
                                intersect: false,
                                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                                titleFont: { family: "'Inter', sans-serif" },
                                bodyFont: { family: "'Inter', sans-serif" },
                                callbacks: {
                                    label: function(context) {
                                        let label = context.dataset.label || '';
                                        if (label) {
                                            label += ': ';
                                        }
                                        if (context.parsed.y !== null) {
                                            label += new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(context.parsed.y);
                                        }
                                        return label;
                                    }
                                }
                            }
                        },
                        interaction: {
                            mode: 'nearest',
                            axis: 'x',
                            intersect: false
                        },
                        scales: {
                            x: {
                                grid: { display: false }, // Remove grid vertical para visual limpo
                                ticks: { font: { family: "'Inter', sans-serif" } }
                            },
                            y: {
                                beginAtZero: true,
                                border: { display: false }, // Remove borda do eixo Y
                                grid: { color: '#f3f4f6' }, // Grid horizontal sutil
                                ticks: { 
                                    font: { family: "'Inter', sans-serif" },
                                    callback: function(value) { return 'R$ ' + value; } 
                                }
                            }
                        }
                    }
                });
                
                // Se não houver dados, mostrar aviso (opcional, ou apenas gráfico vazio)
                if(rawData.length === 0 && evolutionChart) {
                     // Gráfico vazio já tratado pelo destroy/new
                }

            } catch (error) {
                console.error("Erro ao carregar gráfico", error);
                showMessage("Erro", "Falha ao carregar dados do gráfico.");
            }
        };
        
        // ... (rest of listeners: employeeSelect, vacation modal, indices, launchForm, delete, etc) ...
        
        if(employeeSelect) employeeSelect.addEventListener('change', (e) => {
            const empId = e.target.value;
            if (!empId) return renderIndices([]);
            const emp = globalEmployees.find(e => e.id === empId);
            if (!emp) return;
            vacationEmployee = emp;
            if(vacationMessage) vacationMessage.textContent = `${emp.name} está de férias?`;
            showModal(vacationModal);
        });
        
        if(btnVacationNo) btnVacationNo.addEventListener('click', () => {
            if (!vacationEmployee) return;
            const sec = globalSectors.find(s => s.id === vacationEmployee.sectorId);
            renderIndices(sec ? sec.indices : []);
            vacationEmployee = null;
            hideModal(vacationModal);
        });

        if(btnVacationYes) btnVacationYes.addEventListener('click', async () => {
            if (!vacationEmployee) return;
            const month = monthRefInput.value;
            if (!month) return showMessage("Erro", "Selecione o mês.");
            
            const existing = globalHistory.find(l => l.employeeId === vacationEmployee.id);
            if (existing) { hideModal(vacationModal); return showMessage("Bloqueio", "Já existe lançamento para este colaborador."); }

            try {
                await addDoc(getLaunchesCollection(), {
                    monthRef: month, employeeId: vacationEmployee.id, employeeName: vacationEmployee.name, sectorId: vacationEmployee.sectorId,
                    launchedBy: currentUserId, launchedBySupervisor: currentSupervisorId, baseValue: parseFloat(baseValueInput.value) || 0, totalValue: 0, scores: [], status: "FÉRIAS", createdAt: serverTimestamp()
                });
                showMessage("Sucesso", "Férias lançadas.");
                if(employeeSelect) employeeSelect.value = "";
                renderIndices([]);
            } catch (e) { console.error(e); showMessage("Erro", "Falha ao lançar."); }
            finally { vacationEmployee = null; hideModal(vacationModal); }
        });

        const renderIndices = (indices) => {
            if(indicesContainer) indicesContainer.innerHTML = '';
            if (!indices || indices.length === 0) {
                indicesContainer.classList.remove('grid-layout');
                indicesContainer.innerHTML = '<p class="text-sm text-gray-500">Sem índices.</p>';
                return calculateTotal();
            }
            indicesContainer.classList.add('grid-layout');
            indices.forEach(idx => {
                const div = document.createElement('div');
                div.className = 'index-item';
                div.innerHTML = `<label>${idx.name} (Max: ${idx.perc}%)</label><input type="number" class="score-input w-full px-3 py-2 border rounded" data-max="${idx.perc}" data-name="${idx.name}" min="0" max="${idx.perc}">`;
                
                const input = div.querySelector('input');
                input.addEventListener('input', (e) => {
                    const max = parseFloat(e.target.dataset.max);
                    let val = parseFloat(e.target.value);
                    
                    if (val > max) {
                        e.target.value = max;
                    }
                    if (val < 0) {
                        e.target.value = 0;
                    }
                    calculateTotal();
                });
                
                indicesContainer.appendChild(div);
            });
            calculateTotal();
        };

        const calculateTotal = () => {
            const base = parseFloat(baseValueInput.value) || 0;
            let points = 0;
            document.querySelectorAll('.score-input').forEach(inp => points += parseFloat(inp.value) || 0);
            if(totalCalculated) totalCalculated.textContent = `R$ ${(base * (points / 100)).toFixed(2)}`;
        };

        if(launchForm) launchForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const empId = employeeSelect.value;
            const month = monthRefInput.value;
            if (!empId || !month) return showMessage("Erro", "Preencha tudo.");
            
            if (!currentEditingLaunchId) {
                const existing = globalHistory.find(l => l.employeeId === empId);
                if (existing) return showMessage("Bloqueio", "Já existe lançamento.");
            }

            const scores = [];
            let points = 0;
            document.querySelectorAll('.score-input').forEach(inp => {
                const v = parseFloat(inp.value) || 0;
                scores.push({ name: inp.dataset.name, score: v, max: parseFloat(inp.dataset.max) });
                points += v;
            });

            const base = parseFloat(baseValueInput.value) || 0;
            const data = {
                monthRef: month, employeeId: empId, employeeName: globalEmployees.find(e=>e.id===empId).name, sectorId: globalEmployees.find(e=>e.id===empId).sectorId,
                launchedBy: currentUserId, launchedBySupervisor: currentSupervisorId, baseValue: base, totalValue: base * (points / 100), scores: scores, status: "", createdAt: serverTimestamp()
            };

            try {
                if (currentEditingLaunchId) {
                    delete data.createdAt;
                    await updateDoc(doc(getLaunchesCollection(), currentEditingLaunchId), data);
                    showMessage("Sucesso", "Atualizado.");
                } else {
                    await addDoc(getLaunchesCollection(), data);
                    showMessage("Sucesso", "Lançado.");
                }
                if(isSupervisor) updateSupervisorAverage(month, currentSupervisorId, globalSupervisors.find(s=>s.id===currentSupervisorId).name, currentSupervisorSectorId);
                resetLaunchFormToCreateMode();
            } catch (e) { console.error(e); showMessage("Erro", "Falha ao salvar."); }
        });

        const resetLaunchFormToCreateMode = () => {
            currentEditingLaunchId = null;
            if(btnSubmitLaunch) btnSubmitLaunch.textContent = "Lançar Remuneração";
            if(btnCancelEdit) btnCancelEdit.classList.add('hidden');
            if(employeeSelect) employeeSelect.value = "";
            renderIndices([]);
            if(totalCalculated) totalCalculated.textContent = "R$ 0,00";
        };
        if(btnCancelEdit) btnCancelEdit.addEventListener('click', resetLaunchFormToCreateMode);

        const loadLaunchForEdit = async (id) => {
            try {
                const snap = await getDoc(doc(getLaunchesCollection(), id));
                if (!snap.exists()) return showMessage("Erro", "Não encontrado.");
                const data = snap.data();
                monthRefInput.value = data.monthRef;
                await loadBaseValue();
                employeeSelect.value = data.employeeId;
                const emp = globalEmployees.find(e => e.id === data.employeeId);
                const sec = globalSectors.find(s => s.id === emp.sectorId);
                renderIndices(sec ? sec.indices : []);
                setTimeout(() => {
                    data.scores.forEach(s => {
                        const inp = document.querySelector(`.score-input[data-name="${s.name}"]`);
                        if (inp) inp.value = s.score;
                    });
                    calculateTotal();
                }, 100);
                currentEditingLaunchId = id;
                btnSubmitLaunch.textContent = "Salvar Alterações";
                btnCancelEdit.classList.remove('hidden');
                window.scrollTo({ top: 0, behavior: 'smooth' });
            } catch (e) { console.error(e); }
        };

        document.body.addEventListener('click', async (e) => {
            const t = e.target.closest('button');
            if (!t) return;
            if (t.dataset.launchId) document.getElementById(`details-${t.dataset.launchId}`).classList.toggle('hidden');
            if (t.dataset.editId && !t.dataset.editType) loadLaunchForEdit(t.dataset.editId);
            if (t.dataset.deleteId) {
                itemToDelete = { 
                    id: t.dataset.deleteId, 
                    type: t.dataset.deleteType || 'lançamento', 
                    collection: t.dataset.deleteType ? (t.dataset.deleteType === 'supervisor' ? getSupervisorsCollection() : (t.dataset.deleteType === 'sector' ? getSectorsCollection() : getEmployeesCollection())) : getLaunchesCollection(),
                    month: t.dataset.month,
                    supervisorId: t.dataset.supervisor,
                    sectorId: t.dataset.sector
                };
                showModal(deleteConfirmModal);
            }
            if (t.id === 'btn-open-supervisor-modal') { if(supervisorForm) supervisorForm.reset(); showModal(supervisorModal); }
            if (t.id === 'btn-open-sector-modal') { if(sectorForm) sectorForm.reset(); showModal(sectorModal); }
            if (t.id === 'btn-open-employee-modal') { 
                if(employeeForm) employeeForm.reset(); 
                if(isSupervisor) { employeeSector.value = currentSupervisorSectorId; employeeSector.disabled = true; } else employeeSector.disabled = false;
                showModal(employeeModal); 
            }
            if (t.id === 'btn-manage-sector-indices') {
                if(!currentSupervisorSectorId) return;
                const s = globalSectors.find(sec=>sec.id===currentSupervisorSectorId);
                if(s) {
                    editIndicesSectorId.value = s.id; sectorIndicesName.value = s.name;
                    indicesList.innerHTML = '';
                    (s.indices||[]).forEach(i => createIndexField(i.name, i.perc));
                    if(!(s.indices||[]).length) createIndexField();
                    updateIndicesTotal();
                    showModal(sectorIndicesModal);
                }
            }
        });
        
        if(addIndexField) addIndexField.addEventListener('click', () => createIndexField());
        const createIndexField = (n='', p='') => {
            const d = document.createElement('div'); d.className = 'flex items-center gap-2';
            d.innerHTML = `<div class="flex-1"><label class="text-xs">Nome</label><input class="index-name w-full px-3 py-2 border rounded" value="${n}" required></div><div class="w-24"><label class="text-xs">%</label><input type="number" class="index-perc w-full px-3 py-2 border rounded" value="${p}" required></div><button type="button" class="rm-idx text-red-500">X</button>`;
            d.querySelector('.rm-idx').onclick = () => { d.remove(); updateIndicesTotal(); };
            d.querySelector('.index-perc').oninput = updateIndicesTotal;
            indicesList.appendChild(d);
        };
        const updateIndicesTotal = () => {
            let t = 0; document.querySelectorAll('.index-perc').forEach(i => t += parseFloat(i.value)||0);
            indicesTotalPercentage.textContent = `Total: ${t}%`;
            btnSubmitIndicesForm.disabled = t !== 100;
            if(t!==100) indicesTotalPercentage.classList.add('text-red-600'); else indicesTotalPercentage.classList.remove('text-red-600');
        };

        if(sectorIndicesForm) sectorIndicesForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const idx = []; let t = 0;
            document.querySelectorAll('#indices-list .flex').forEach(r => {
                const n = r.querySelector('.index-name').value.trim(); const p = parseFloat(r.querySelector('.index-perc').value);
                if(n && p>0) { idx.push({name:n, perc:p}); t+=p; }
            });
            if(t!==100) return alert("Total deve ser 100%");
            await updateDoc(doc(getSectorsCollection(), editIndicesSectorId.value), {indices: idx});
            alert("Salvo."); hideModal(sectorIndicesModal);
        });

        [cancelSupervisorModal, cancelSectorModal, cancelEmployeeModal, cancelSectorIndicesModal, btnCancelDelete].forEach(b => b ? b.onclick = () => document.querySelectorAll('.modal').forEach(m=>m.style.display='none') : null);

        if(supervisorForm) supervisorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const p = supervisorPassword.value;
            const data = { name: supervisorName.value, sectorId: supervisorSector.value, username: supervisorUsername.value.toLowerCase() };
            if(p) data.passwordHash = await digestMessage(p);
            else if(!editSupervisorId.value) return alert("Senha obrigatória");
            
            const sectorTaken = globalSupervisors.find(s => s.sectorId === supervisorSector.value && s.id !== editSupervisorId.value);
            if (sectorTaken) return showMessage("Erro", "Setor já tem supervisor.");

            const col = getSupervisorsCollection();
            if(editSupervisorId.value) await updateDoc(doc(col, editSupervisorId.value), data);
            else await addDoc(col, data);
            alert("Salvo."); hideModal(supervisorModal);
        });

        if(sectorForm) sectorForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { name: sectorName.value.trim() };
            const col = getSectorsCollection();
            if(editSectorId.value) await updateDoc(doc(col, editSectorId.value), data);
            else { data.indices = []; await addDoc(col, data); }
            alert("Salvo."); hideModal(sectorModal);
        });

        if(employeeForm) employeeForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = { name: employeeName.value.trim(), sectorId: employeeSector.value };
            const col = getEmployeesCollection();
            if(editEmployeeId.value) await updateDoc(doc(col, editEmployeeId.value), data);
            else await addDoc(col, data);
            alert("Salvo."); hideModal(employeeModal);
        });

        let itemToDelete = {};
        if(btnConfirmDelete) btnConfirmDelete.addEventListener('click', async () => {
            if(!itemToDelete.id) return;
            try { 
                await deleteDoc(doc(itemToDelete.collection, itemToDelete.id)); 
                
                if (itemToDelete.type === 'lançamento' && itemToDelete.supervisorId && itemToDelete.month) {
                    const sup = globalSupervisors.find(s => s.id === itemToDelete.supervisorId);
                    const supName = sup ? sup.name : 'Supervisor';
                    await updateSupervisorAverage(itemToDelete.month, itemToDelete.supervisorId, supName, itemToDelete.sectorId);
                }
                
                alert("Excluído."); 
            }
            catch(e){ console.error(e); alert("Erro ao excluir."); }
            hideModal(deleteConfirmModal);
        });

        const renderSupervisorsTable = () => {
            supervisorsTableBody.innerHTML = globalSupervisors.map(s => {
                const sec = globalSectors.find(x=>x.id===s.sectorId);
                return `<tr><td class="px-4 py-2">${s.name}</td><td class="px-4 py-2">${s.username}</td><td class="px-4 py-2">${sec?sec.name:'-'}</td><td class="px-4 py-2"><button class="text-blue-600 mr-2" onclick="openSupEdit('${s.id}')">Editar</button><button class="text-red-600" data-delete-id="${s.id}" data-delete-type="supervisor">Excluir</button></td></tr>`;
            }).join('');
        };
        
        const renderSectorsTable = () => {
            sectorsTableBody.innerHTML = globalSectors.map(s => `<tr><td class="px-4 py-2">${s.name}</td><td class="px-4 py-2">${(s.indices||[]).length} índices</td><td class="px-4 py-2"><button class="text-red-600" data-delete-id="${s.id}" data-delete-type="sector">Excluir</button></td></tr>`).join('');
        };
        const renderEmployeesTable = () => {
            employeesTableBody.innerHTML = globalEmployees.map(e => {
                const sec = globalSectors.find(x=>x.id===e.sectorId);
                return `<tr><td class="px-4 py-2">${e.name}</td><td class="px-4 py-2">${sec?sec.name:'-'}</td><td class="px-4 py-2"><button class="text-blue-600 mr-2" onclick="openEmpEdit('${e.id}')">Editar</button><button class="text-red-600" data-delete-id="${e.id}" data-delete-type="employee">Excluir</button></td></tr>`;
            }).join('');
        };
        
        window.openSupEdit = (id) => {
            const s = globalSupervisors.find(x=>x.id===id);
            if(s) {
                editSupervisorId.value = s.id; supervisorName.value = s.name; supervisorSector.value = s.sectorId; supervisorUsername.value = s.username;
                supervisorPassword.required = false; supervisorPassword.placeholder = "Deixe em branco para manter";
                showModal(supervisorModal);
            }
        };
        window.openEmpEdit = (id) => {
            const e = globalEmployees.find(x=>x.id===id);
            if(e) {
                editEmployeeId.value = e.id; employeeName.value = e.name; employeeSector.value = e.sectorId;
                employeeSector.disabled = false;
                showModal(employeeModal);
            }
        };

        const updateSupervisorAverage = async (month, supervisorId, supervisorName, sectorId) => {
            if (!month || !supervisorId || !supervisorName) return;
            try {
                const q = query(getLaunchesCollection(), 
                    where("monthRef", "==", month), 
                    where("launchedBySupervisor", "==", supervisorId),
                    where("status", "==", "")
                );
                const querySnapshot = await getDocs(q);
                let totalSum = 0;
                let launchCount = 0;
                
                querySnapshot.docs.forEach(doc => {
                    const data = doc.data();
                    if (data.type !== 'average') {
                        totalSum += data.totalValue;
                        launchCount++;
                    }
                });

                if (launchCount === 0) {
                    const avgLaunchId = `avg_${supervisorId}_${month.replace('-', '')}`;
                    await deleteDoc(doc(getLaunchesCollection(), avgLaunchId));
                    return;
                }

                const averageValue = totalSum / launchCount;
                const avgLaunchId = `avg_${supervisorId}_${month.replace('-', '')}`;
                
                const avgLaunchData = {
                    monthRef: month,
                    employeeId: `avg_${supervisorId}`, 
                    employeeName: `${supervisorName} (Média Equipe)`,
                    sectorId: sectorId,
                    launchedBy: 'system',
                    launchedBySupervisor: supervisorId,
                    baseValue: 0,
                    totalValue: averageValue,
                    scores: [],
                    status: "MÉDIA",
                    type: "average",
                    createdAt: serverTimestamp()
                };
                await setDoc(doc(getLaunchesCollection(), avgLaunchId), avgLaunchData, { merge: true }); 
            } catch (error) { console.error("Erro media:", error); }
        };

        if(btnDownloadCSV) btnDownloadCSV.addEventListener('click', () => {
            if (!globalHistory || globalHistory.length === 0) return alert("Sem dados para exportar.");
            
            // CORREÇÃO AQUI: Adicionado \uFEFF no início. Isso é o "BOM" que avisa ao Excel que tem acentos.
            let csvContent = "\uFEFF"; 
            csvContent += "Mês Ref;Colaborador;Setor;Valor Base;Valor Total;Data Lançamento;Status;Detalhes\n";

            globalHistory.forEach(row => {
                const date = row.createdAt instanceof Date ? row.createdAt.toLocaleDateString('pt-BR') : '-';
                const details = (row.scores || []).map(s => `${s.name}: ${s.score}/${s.max}`).join(' | ');
                
                const line = [
                    row.monthRef,
                    row.employeeName,
                    row.sectorName,
                    row.baseValue.toFixed(2).replace('.', ','),
                    row.totalValue.toFixed(2).replace('.', ','),
                    date,
                    row.status || 'OK',
                    details
                ].map(field => String(field || '').replace(/;/g, ',')).join(';'); 
                
                csvContent += line + "\n";
            });

            // CORREÇÃO AQUI: Usamos "Blob" para criar o arquivo de forma mais robusta para acentos
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement("a");
            link.setAttribute("href", url);
            link.setAttribute("download", `remuneracao_${monthRefInput.value || 'geral'}.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            // Limpeza da memória do navegador
            URL.revokeObjectURL(url);
        });

        if(showPassword) showPassword.addEventListener('change', (e) => {
            supervisorPassword.type = e.target.checked ? 'text' : 'password';
        });

        startFirebase();
   