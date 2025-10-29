// Session storage keys
const SESSION_STORAGE_KEY = 'wedding_admin_session';
const SESSION_TIMESTAMP_KEY = 'wedding_admin_session_timestamp';
// Initialize Supabase
const supabaseUrl = 'https://pgflfafjylxxnlyiztoe.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBnZmxmYWZqeWx4eG5seWl6dG9lIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NTYxMjIsImV4cCI6MjA3NzMzMjEyMn0.mqiBN8biRUXW_0dH9kXCCYrttJX3Vf2bnNi3Y-W8Hro';
const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
// DOM Elements
const loginSection = document.getElementById('loginSection');
const adminDashboard = document.getElementById('adminDashboard');
const loginForm = document.getElementById('loginForm');
const logoutLink = document.getElementById('logoutLink');
const dashboardLink = document.getElementById('dashboardLink');
const guestsLink = document.getElementById('guestsLink');
const giftAccountsLink = document.getElementById('giftAccountsLink');
const dashboardSection = document.getElementById('dashboardSection');
const guestsSection = document.getElementById('guestsSection');
const giftAccountsSection = document.getElementById('giftAccountsSection');
const mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
const sidebar = document.querySelector('.sidebar');
const mainContent = document.querySelector('.main-content');
const loadingOverlay = document.getElementById('loadingOverlay');
// Stats Elements
const totalGuests = document.getElementById('totalGuests');
const attendingGuests = document.getElementById('attendingGuests');
const giftsReceived = document.getElementById('giftsReceived');
// Tables
let guestsTable;
let giftAccountsTable;
let recentGuestsTable;
// Modals
const guestModal = new bootstrap.Modal(document.getElementById('guestModal'));
const giftAccountModal = new bootstrap.Modal(document.getElementById('giftAccountModal'));
const confirmModal = new bootstrap.Modal(document.getElementById('confirmModal'));
// Form Elements
const addGuestBtn = document.getElementById('addGuestBtn');
const saveGuestBtn = document.getElementById('saveGuestBtn');
const addGiftAccountBtn = document.getElementById('addGiftAccountBtn');
const saveGiftAccountBtn = document.getElementById('saveGiftAccountBtn');
const confirmActionBtn = document.getElementById('confirmActionBtn');
// Current action callback
let currentActionCallback = null;
// Check authentication state on page load
document.addEventListener('DOMContentLoaded', async () => {
    await checkAuthState();
});

// Save session to local storage
function saveSessionToStorage(session) {
    if (!session) return;

    localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    localStorage.setItem(SESSION_TIMESTAMP_KEY, Date.now().toString());
}

// Get session from local storage
function getSessionFromStorage() {
    const sessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
    const timestampStr = localStorage.getItem(SESSION_TIMESTAMP_KEY);

    if (!sessionStr || !timestampStr) return null;

    // Check if session is expired (older than 1 hour)
    const timestamp = parseInt(timestampStr);
    if (Date.now() - timestamp > 3600000) { // 1 hour
        clearSessionStorage();
        return null;
    }

    return JSON.parse(sessionStr);
}

// Clear session from storage
function clearSessionStorage() {
    localStorage.removeItem(SESSION_STORAGE_KEY);
    localStorage.removeItem(SESSION_TIMESTAMP_KEY);
}

// Check authentication state
async function checkAuthState() {
    try {

        // First check local storage
        const cachedSession = getSessionFromStorage();

        if (cachedSession) {
            // Verify with Supabase (quick check)
            const { data: { session }, error } = await supabase.auth.getSession();

            if (!error && session && session.user.email === cachedSession.user.email) {
                // Cached session is still valid
                showAdminDashboard();
                loadDashboardStats();
                initializeDataTables();
                return;
            }
            // If verification failed, clear cache and continue to normal auth flow
            clearSessionStorage();
        }

        // Normal auth flow
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) throw error;

        if (session) {
            showLoading();

            // Check if user is admin
            const { data: adminUser, error: adminError } = await supabase
                .from('admin_users')
                .select('*')
                .eq('email', session.user.email)
                .single();

            if (adminError) throw adminError;

            if (adminUser) {
                // Save to local storage
                saveSessionToStorage(session);
                showAdminDashboard();
                loadDashboardStats();
                initializeDataTables();
                return;
            }
        }

        // If we get here, either no session or not admin
        await supabase.auth.signOut();
        showLogin();
    } catch (error) {
        console.error('Auth check error:', error);
        showLogin();
    } finally {
        hideLoading();
    }
}

// Show login section
function showLogin() {
    loginSection.style.display = 'block';
    adminDashboard.style.display = 'none';
    document.body.classList.remove('sidebar-open');
}
// Show admin dashboard
function showAdminDashboard() {
    loginSection.style.display = 'none';
    adminDashboard.style.display = 'block';
    showSection('dashboard');
}
// Login form submission
loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    showLoading();
    try {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;

        // Check if user is admin
        const { data: adminUser, error: adminError } = await supabase
            .from('admin_users')
            .select('*')
            .eq('email', data.user.email)
            .single();

        if (adminError) throw adminError;

        if (!adminUser) {
            await supabase.auth.signOut();
            throw new Error('User is not an admin');
        }

        // Save session to local storage
        saveSessionToStorage(data.session);
        showAdminDashboard();
        loadDashboardStats();
        initializeDataTables();
    } catch (error) {
        alert('Login failed: ' + error.message);
    } finally {
        hideLoading();
    }
});

// Logout
logoutLink.addEventListener('click', async (e) => {
    e.preventDefault();
    try {
        showLoading();
        await supabase.auth.signOut();
        clearSessionStorage(); // Clear cached session
        showLogin();
    } catch (error) {
        alert('Logout failed: ' + error.message);
    } finally {
        hideLoading();
    }
});

// Navigation
dashboardLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('dashboard');
    closeSidebar();
});
guestsLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('guests');
    closeSidebar();
});
giftAccountsLink.addEventListener('click', (e) => {
    e.preventDefault();
    showSection('giftAccounts');
    closeSidebar();
});



//  showSection function to only load data when needed
function showSection(section) {
    dashboardSection.style.display = 'none';
    guestsSection.style.display = 'none';
    giftAccountsSection.style.display = 'none';

    // Remove active class from all nav links
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });

    // Add active class to clicked nav link and show section
    if (section === 'dashboard') {
        dashboardSection.style.display = 'block';
        dashboardLink.classList.add('active');
        // Only load stats if they haven't been loaded recently
        if (!dashboardSection.dataset.loaded ||
        Date.now() - parseInt(dashboardSection.dataset.loaded) > 300000) { // 5 minutes
            loadDashboardStats();
            dashboardSection.dataset.loaded = Date.now();
        }
    } else if (section === 'guests') {
        guestsSection.style.display = 'block';
        guestsLink.classList.add('active');
        // Only refresh if table hasn't been loaded or is older than 1 minute
        if (!guestsSection.dataset.loaded ||
        Date.now() - parseInt(guestsSection.dataset.loaded) > 60000) {
            refreshGuestsTable();
            guestsSection.dataset.loaded = Date.now();
        }
    } else if (section === 'giftAccounts') {
        giftAccountsSection.style.display = 'block';
        giftAccountsLink.classList.add('active');
        // Only refresh if table hasn't been loaded or is older than 1 minute
        if (!giftAccountsSection.dataset.loaded ||
        Date.now() - parseInt(giftAccountsSection.dataset.loaded) > 60000) {
            refreshGiftAccountsTable();
            giftAccountsSection.dataset.loaded = Date.now();
        }
    }
}

// Sidebar toggle for mobile
mobileSidebarToggle.addEventListener('click', () => {
    sidebar.classList.toggle('active');
    document.body.classList.toggle('sidebar-open');
});
// Add this to your script.js
document.addEventListener('DOMContentLoaded', () => {
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
        if (window.innerWidth < 992 &&
        !sidebar.contains(e.target) &&
        !mobileSidebarToggle.contains(e.target) &&
        sidebar.classList.contains('active')) {
            closeSidebar();
        }
    });

    // Close sidebar when clicking a nav link on mobile
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', () => {
            if (window.innerWidth < 992) {
                closeSidebar();
            }
        });
    });
});
// Update the closeSidebar function
function closeSidebar() {
    sidebar.classList.remove('active');
    document.body.classList.remove('sidebar-open');
}
// Load dashboard stats
async function loadDashboardStats() {
    showLoading();
    try {
        // Total guests
        const { count: totalCount } = await supabase
            .from('wedding_guests')
            .select('*', { count: 'exact', head: true });
        // Attending guests
        // Sum of guest_count for attending guests
        const { data, error } = await supabase
            .from('wedding_guests')
            .select('guest_count')
            .eq('is_attending', true);

        const totalAttendingGuests = data.reduce((sum, guest) => sum + (guest.guest_count || 0), 0);

        // Guests with gifts
        const { count: giftsCount } = await supabase
            .from('wedding_guests')
            .select('*', { count: 'exact', head: true })
            .not('gift_method', 'is', null);
        totalGuests.textContent = totalCount || 0;
        attendingGuests.textContent = totalAttendingGuests;
        giftsReceived.textContent = giftsCount || 0;

        // Only reload if table is initialized
        if (recentGuestsTable && $.fn.DataTable.isDataTable('#recentGuestsTable')) {
            recentGuestsTable.ajax.reload(null, false); // false means don't reset paging
        }
    }catch (error) {
        console.error('Error loading dashboard stats:', error);
        alert('Failed to load dashboard stats: ' + error.message);
    }
    finally {
        hideLoading();
    }
}
// Initialize DataTables
function initializeDataTables() {
    // Recent Guests Table
    recentGuestsTable = $('#recentGuestsTable').DataTable({
        responsive: true,
        ajax: function(data, callback, settings) {
            supabase
                .from('wedding_guests')
                .select('*')
                .order('submitted_at', { ascending: false })
                .limit(5)
                .then(({ data: guests, error }) => {
                if (error) throw error;
                callback({ data: guests });
            })
                .catch(error => {
                console.error('Error loading recent guests:', error);
                callback({ data: [] });
            });
        },
        columns: [
            { data: 'name' },
            { data: 'email' },
            {
                data: 'is_attending',
                render: data =>
                data
                ? '<span class="badge bg-success">Yes</span>'
                : '<span class="badge bg-danger">No</span>'
            },
            { data: 'guest_count' },
            {
                data: 'gift_method',
                render: data =>
                data
                ? `<span class="badge bg-info">${data.charAt(0).toUpperCase() + data.slice(1)}</span>`
                : '<span class="text-muted">None</span>'
            },
            {
                data: 'submitted_at',
                render: data =>
                new Date(data).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            }
        ],
        createdRow: function(row, data, dataIndex) {
            $(row).addClass('slide-in');
            $(row).css('animation-delay', `${dataIndex * 0.1}s`);
        }
    });
    // Guests Table
    guestsTable = $('#guestsTable').DataTable({
        responsive: true,
        ajax: function(data, callback, settings) {
            supabase
                .from('wedding_guests')
                .select('*')
                .order('submitted_at', { ascending: false })
                .then(({ data: guests, error }) => {
                if (error) throw error;
                callback({ data: guests });
            })
                .catch(error => {
                console.error('Error loading guests:', error);
                callback({ data: [] });
            });
        },
        columns: [
            { data: 'name' },
            { data: 'email' },
            {
                data: 'phone',
                render: data => data || '<span class="text-muted">N/A</span>'
            },
            {
                data: 'is_attending',
                render: data =>
                data
                ? '<span class="badge bg-success">Yes</span>'
                : '<span class="badge bg-danger">No</span>'
            },
            { data: 'guest_count' },
            {
                data: 'gift_method',
                render: data =>
                data
                ? `<span class="badge bg-info">${data.charAt(0).toUpperCase() + data.slice(1)}</span>`
                : '<span class="text-muted">None</span>'
            },
            {
                data: 'submitted_at',
                render: data =>
                new Date(data).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric'
                })
            },
            {
                data: 'id',
                render: (data, type, row) => `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary edit-guest" data-id="${data}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-guest" data-id="${data}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `,
                orderable: false
            }
        ],
        createdRow: function(row, data, dataIndex) {
            $(row).addClass('slide-in');
            $(row).css('animation-delay', `${dataIndex * 0.05}s`);
        }
    });
    // Gift Accounts Table
    giftAccountsTable = $('#giftAccountsTable').DataTable({
        responsive: true,
        ajax: function(data, callback, settings) {
            supabase
                .from('gift_accounts')
                .select('*')
                .order('id', { ascending: true })
                .then(({ data: accounts, error }) => {
                if (error) throw error;
                callback({ data: accounts });
            })
                .catch(error => {
                console.error('Error loading gift accounts:', error);
                callback({ data: [] });
            });
        },
        columns: [
            {
                data: 'method',
                render: data =>
                `<span class="badge bg-primary">${data.charAt(0).toUpperCase() + data.slice(1)}</span>`
            },
            {
                data: 'account_type',
                render: data => data || '<span class="text-muted">N/A</span>'
            },
            {
                data: 'account_name',
                render: data => data || '<span class="text-muted">N/A</span>'
            },
            {
                data: 'account_details',
                render: data =>
                data
                ? data.substring(0, 30) + (data.length > 30 ? '...' : '')
                : '<span class="text-muted">N/A</span>'
            },
            {
                data: 'active',
                render: data =>
                data
                ? '<span class="badge bg-success">Active</span>'
                : '<span class="badge bg-secondary">Inactive</span>'
            },
            {
                data: 'id',
                render: (data, type, row) => `
                    <div class="btn-group btn-group-sm">
                        <button class="btn btn-outline-primary edit-gift-account" data-id="${data}">
                            <i class="bi bi-pencil"></i>
                        </button>
                        <button class="btn btn-outline-danger delete-gift-account" data-id="${data}">
                            <i class="bi bi-trash"></i>
                        </button>
                    </div>
                `,
                orderable: false
            }
        ],
        createdRow: function(row, data, dataIndex) {
            $(row).addClass('slide-in');
            $(row).css('animation-delay', `${dataIndex * 0.05}s`);
        }
    });
    // Event Listeners
    $('#guestsTable tbody').on('click', '.edit-guest', function() {
        const guestId = $(this).data('id');
        editGuest(guestId);
    });
    $('#guestsTable tbody').on('click', '.delete-guest', function() {
        const guestId = $(this).data('id');
        showConfirmModal(
            'Delete Guest',
            'Are you sure you want to delete this guest? This action cannot be undone.',
            () => deleteGuest(guestId)
        );
    });
    $('#giftAccountsTable tbody').on('click', '.edit-gift-account', function() {
        const accountId = $(this).data('id');
        editGiftAccount(accountId);
    });

    $('#giftAccountsTable tbody').on('click', '.delete-gift-account', function() {
        const accountId = $(this).data('id');
        showConfirmModal(
            'Delete Gift Account',
            'Are you sure you want to delete this gift account? This action cannot be undone.',
            () => deleteGiftAccount(accountId)
        );
    });
}
// Event Listeners for Guest Management
addGuestBtn.addEventListener('click', () => {
    document.getElementById('guestModalTitle').textContent = 'Add Guest';
    document.getElementById('guestForm').reset();
    document.getElementById('guestId').value = '';
    guestModal.show();
});
saveGuestBtn.addEventListener('click', async () => {
    const guestId = document.getElementById('guestId').value;
    const guestData = {
        name: document.getElementById('guestName').value,
        email: document.getElementById('guestEmail').value,
        phone: document.getElementById('guestPhone').value,
        is_attending: document.querySelector('input[name="guestAttending"]:checked').value === 'true',
        guest_count: parseInt(document.getElementById('guestCount').value),
        gift_method: document.getElementById('guestGiftMethod').value || null,
        gift_message: document.getElementById('guestGiftMessage').value || null
    };

    guestModal.hide();
    showLoading();
    try {
        if (guestId) {
            // Update existing guest
            const { error } = await supabase
                .from('wedding_guests')
                .update(guestData)
                .eq('id', guestId);

            if (error) throw error;
        } else {
            // Create new guest
            const { error } = await supabase
                .from('wedding_guests')
                .insert(guestData);

            if (error) throw error;
        }
        guestModal.hide();
        refreshGuestsTable();
        loadDashboardStats();
    } catch (error) {
        guestModal.show();
        alert('Error saving guest: ' + error.message);
    } finally {
        hideLoading();
    }
});
// Event Listeners for Gift Account Management
addGiftAccountBtn.addEventListener('click', () => {
    document.getElementById('giftAccountModalTitle').textContent = 'Add Gift Account';
    document.getElementById('giftAccountForm').reset();
    document.getElementById('giftAccountId').value = '';
    giftAccountModal.show();
});
saveGiftAccountBtn.addEventListener('click', async () => {
    const accountId = document.getElementById('giftAccountId').value;
    const accountData = {
        method: document.getElementById('accountMethod').value,
        account_type: document.getElementById('accountType').value,
        account_name: document.getElementById('accountName').value || null,
        account_details: document.getElementById('accountDetails').value,
        instructions: document.getElementById('accountInstructions').value || null,
        qr_code_url: document.getElementById('qrCodeUrl').value || null,
        active: document.getElementById('accountActive').checked
    };

    giftAccountModal.hide();
    showLoading();

    try {
        if (accountId) {
            // Update existing account
            accountData.updated_at = new Date().toISOString();
            const { error } = await supabase
                .from('gift_accounts')
                .update(accountData)
                .eq('id', accountId);

            if (error) throw error;
        } else {
            // Create new account
            const { error } = await supabase
                .from('gift_accounts')
                .insert(accountData);

            if (error) throw error;
        }

        giftAccountModal.hide();
        refreshGiftAccountsTable();
    } catch (error) {
        giftAccountModal.show();
        alert('Error saving gift account: ' + error.message);
    } finally {
        hideLoading();
    }
});
// Confirmation Modal
confirmActionBtn.addEventListener('click', () => {
    if (currentActionCallback) {
        currentActionCallback();
    }
    confirmModal.hide();
});
// Helper Functions
function showConfirmModal(title, message, callback) {
    document.querySelector('#confirmModal .modal-title').textContent = title;
    document.getElementById('confirmModalBody').textContent = message;
    currentActionCallback = callback;
    confirmModal.show();
}
async function editGuest(guestId) {
    showLoading();
    try {
        const { data: guest, error } = await supabase
            .from('wedding_guests')
            .select('*')
            .eq('id', guestId)
            .single();

        if (error) throw error;

        document.getElementById('guestModalTitle').textContent = 'Edit Guest';
        document.getElementById('guestId').value = guest.id;
        document.getElementById('guestName').value = guest.name;
        document.getElementById('guestEmail').value = guest.email;
        document.getElementById('guestPhone').value = guest.phone || '';
        document.getElementById(`guestAttending${guest.is_attending ? 'Yes' : 'No'}`).checked = true;
        document.getElementById('guestCount').value = guest.guest_count || 1;
        document.getElementById('guestGiftMethod').value = guest.gift_method || '';
        document.getElementById('guestGiftMessage').value = guest.gift_message || '';
        guestModal.show();
    } catch (error) {
        alert('Error loading guest: ' + error.message);
    } finally {
        hideLoading();
    }
}
async function deleteGuest(guestId) {
    showLoading();
    try {
        const { error } = await supabase
            .from('wedding_guests')
            .delete()
            .eq('id', guestId);

        if (error) throw error;

        refreshGuestsTable();
        loadDashboardStats();
    } catch (error) {
        alert('Error deleting guest: ' + error.message);
    } finally {
        hideLoading();
    }
}
async function editGiftAccount(accountId) {
    showLoading();
    try {
        const { data: account, error } = await supabase
            .from('gift_accounts')
            .select('*')
            .eq('id', accountId)
            .single();
        if (error) throw error;
        document.getElementById('giftAccountModalTitle').textContent = 'Edit Gift Account';
        document.getElementById('giftAccountId').value = account.id;
        document.getElementById('accountMethod').value = account.method;
        document.getElementById('accountType').value = account.account_type;
        document.getElementById('accountName').value = account.account_name || '';
        document.getElementById('accountDetails').value = account.account_details;
        document.getElementById('accountInstructions').value = account.instructions || '';
        document.getElementById('qrCodeUrl').value = account.qr_code_url || '';
        document.getElementById('accountActive').checked = account.active;
        giftAccountModal.show();
    } catch (error) {
        alert('Error loading gift account: ' + error.message);
    } finally {
        hideLoading();
    }
}
async function deleteGiftAccount(accountId) {
    showLoading();
    try {
        const { error } = await supabase
            .from('gift_accounts')
            .delete()
            .eq('id', accountId);

        if (error) throw error;

        refreshGiftAccountsTable();
    } catch (error) {
        alert('Error deleting gift account: ' + error.message);
    } finally {
        hideLoading();
    }
}
function refreshGuestsTable() {
    if (guestsTable) {
        guestsTable.ajax.reload();
    }
}
function refreshGiftAccountsTable() {
    if (giftAccountsTable) {
        giftAccountsTable.ajax.reload();
    }
}
function showLoading() {
    loadingOverlay.classList.add('show');
}
function hideLoading() {
    loadingOverlay.classList.remove('show');
}