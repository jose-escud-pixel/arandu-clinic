"""
Test suite for Phase 2: Admin System for Arandu Clinic
Tests:
- POST /api/auth/register - First user becomes admin with active status, subsequent users are pending
- POST /api/auth/login - Pending users get 403 error, active users can login
- GET /api/auth/me - Returns role, status, specialty, license_number fields
- PUT /api/auth/profile - Update name, specialty, license_number
- PUT /api/auth/change-password - Change own password with current password verification
- GET /api/admin/users - Returns all users (admin only)
- GET /api/admin/pending-users - Returns pending users only (admin only)
- PUT /api/admin/users/{id}/approve - Approves pending user
- PUT /api/admin/users/{id}/reject - Rejects user
- PUT /api/admin/users/{id}/change-password - Admin changes another user password
- PUT /api/admin/users/{id}/role?role=admin - Change user role
- DELETE /api/admin/users/{id} - Delete user (cannot delete self)
"""

import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

# Test credentials
ADMIN_EMAIL = "admin@test.com"
ADMIN_PASSWORD = "admin123"

@pytest.fixture(scope="module")
def admin_token():
    """Get admin authentication token"""
    response = requests.post(f"{BASE_URL}/api/auth/login", json={
        "email": ADMIN_EMAIL,
        "password": ADMIN_PASSWORD
    })
    if response.status_code != 200:
        pytest.skip(f"Admin login failed: {response.status_code} - {response.text}")
    data = response.json()
    assert "token" in data
    return data["token"]

@pytest.fixture(scope="module")
def admin_headers(admin_token):
    """Admin auth headers"""
    return {"Authorization": f"Bearer {admin_token}"}


# ============== AUTH TESTS ==============

class TestAuthLogin:
    """Test login functionality with status checks"""
    
    def test_admin_login_success(self):
        """Active admin can login successfully"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
        data = response.json()
        assert "token" in data
        assert "doctor" in data
        assert data["doctor"]["email"] == ADMIN_EMAIL
        assert data["doctor"]["role"] == "admin"
        assert data["doctor"]["status"] == "active"
    
    def test_login_invalid_credentials(self):
        """Invalid credentials return 401"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "wrong@test.com",
            "password": "wrongpass"
        })
        assert response.status_code == 401


class TestAuthMe:
    """Test GET /api/auth/me endpoint returns correct fields"""
    
    def test_me_returns_role_status_fields(self, admin_headers):
        """GET /api/auth/me returns role, status, specialty, license_number"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.status_code == 200, f"Expected 200, got {response.status_code}"
        data = response.json()
        
        # Required fields
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "role" in data
        assert "status" in data
        
        # New fields (can be null but must exist)
        assert "specialty" in data
        assert "license_number" in data
        
        # Verify admin user data
        assert data["email"] == ADMIN_EMAIL
        assert data["role"] == "admin"
        assert data["status"] == "active"
    
    def test_me_without_token_returns_401(self):
        """GET /api/auth/me without token returns 401"""
        response = requests.get(f"{BASE_URL}/api/auth/me")
        assert response.status_code in [401, 403]


class TestAuthProfile:
    """Test PUT /api/auth/profile - Update profile"""
    
    def test_update_profile_name(self, admin_headers):
        """Can update name via profile endpoint"""
        # Get original data
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        original_name = response.json()["name"]
        
        # Update name
        new_name = "Admin Test Updated"
        response = requests.put(f"{BASE_URL}/api/auth/profile", 
            json={"name": new_name}, 
            headers=admin_headers
        )
        assert response.status_code == 200
        assert response.json()["message"] == "Perfil actualizado"
        
        # Verify change
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.json()["name"] == new_name
        
        # Restore original name
        requests.put(f"{BASE_URL}/api/auth/profile", 
            json={"name": original_name}, 
            headers=admin_headers
        )
    
    def test_update_profile_specialty(self, admin_headers):
        """Can update specialty via profile endpoint"""
        response = requests.put(f"{BASE_URL}/api/auth/profile", 
            json={"specialty": "Traumatologia"}, 
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.json()["specialty"] == "Traumatologia"
    
    def test_update_profile_license_number(self, admin_headers):
        """Can update license_number via profile endpoint"""
        response = requests.put(f"{BASE_URL}/api/auth/profile", 
            json={"license_number": "MP-ADMIN-12345"}, 
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        assert response.json()["license_number"] == "MP-ADMIN-12345"


class TestAuthChangePassword:
    """Test PUT /api/auth/change-password - Change own password"""
    
    def test_change_password_wrong_current(self, admin_headers):
        """Change password fails with wrong current password"""
        response = requests.put(f"{BASE_URL}/api/auth/change-password",
            json={"current_password": "wrongpassword", "new_password": "newpass123"},
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "incorrecta" in response.json()["detail"].lower()
    
    def test_change_password_success_and_revert(self, admin_headers):
        """Change password succeeds with correct current password"""
        # Change to new password
        response = requests.put(f"{BASE_URL}/api/auth/change-password",
            json={"current_password": ADMIN_PASSWORD, "new_password": "temppass123"},
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify can login with new password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": "temppass123"
        })
        assert response.status_code == 200
        new_token = response.json()["token"]
        
        # Revert password back to original
        response = requests.put(f"{BASE_URL}/api/auth/change-password",
            json={"current_password": "temppass123", "new_password": ADMIN_PASSWORD},
            headers={"Authorization": f"Bearer {new_token}"}
        )
        assert response.status_code == 200
        
        # Verify can login with original password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": ADMIN_EMAIL,
            "password": ADMIN_PASSWORD
        })
        assert response.status_code == 200


# ============== ADMIN ENDPOINTS TESTS ==============

class TestAdminGetUsers:
    """Test GET /api/admin/users - Admin only"""
    
    def test_admin_get_all_users(self, admin_headers):
        """Admin can get all users"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        assert len(data) > 0  # Should have at least admin user
        
        # Verify user structure
        for user in data:
            assert "id" in user
            assert "email" in user
            assert "name" in user
            assert "role" in user
            assert "status" in user
            assert "password" not in user  # Password should be excluded
    
    def test_non_admin_cannot_get_users(self, admin_headers):
        """Non-admin user gets 403 on admin endpoints"""
        # Register a new test user that will be doctor role
        test_email = f"TEST_nonadmin_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "TEST NonAdmin User"
        })
        assert response.status_code == 200
        
        # Get user ID from admin list
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        assert test_user is not None
        test_user_id = test_user["id"]
        
        # Approve the user so they can login
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/approve", 
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Login as non-admin user
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        non_admin_token = response.json()["token"]
        
        # Try to access admin endpoint - should get 403
        response = requests.get(f"{BASE_URL}/api/admin/users", 
            headers={"Authorization": f"Bearer {non_admin_token}"}
        )
        assert response.status_code == 403, f"Non-admin should get 403, got {response.status_code}"
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{test_user_id}", headers=admin_headers)


class TestAdminPendingUsers:
    """Test GET /api/admin/pending-users"""
    
    def test_get_pending_users(self, admin_headers):
        """Admin can get pending users only"""
        response = requests.get(f"{BASE_URL}/api/admin/pending-users", headers=admin_headers)
        assert response.status_code == 200
        data = response.json()
        assert isinstance(data, list)
        
        # All returned users should have status=pending
        for user in data:
            assert user["status"] == "pending"


class TestAdminUserWorkflow:
    """Test approve, reject, role change, password change, delete workflows"""
    
    def test_full_user_workflow(self, admin_headers):
        """Test complete user management workflow: register -> approve -> change role -> change password -> delete"""
        
        # 1. Register a new test user
        test_email = f"TEST_workflow_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "TEST Workflow User"
        })
        assert response.status_code == 200, f"Register failed: {response.text}"
        data = response.json()
        assert data.get("pending") == True  # Should be pending (not first user)
        assert "message" in data
        
        # 2. Get the user ID from admin users list
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        assert response.status_code == 200
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        assert test_user is not None, f"Could not find registered user {test_email}"
        test_user_id = test_user["id"]
        
        # Verify user is pending
        assert test_user["status"] == "pending"
        assert test_user["role"] == "doctor"  # Default role
        
        # 3. Verify pending user cannot login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        assert response.status_code == 403, f"Pending user should get 403, got {response.status_code}"
        assert "pendiente" in response.json()["detail"].lower()
        
        # 4. Approve the user
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/approve", 
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "aprobado" in response.json()["message"].lower()
        
        # 5. Verify approved user can now login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        assert response.status_code == 200
        
        # 6. Change user role to admin
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/role?role=admin", 
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "admin" in response.json()["message"].lower()
        
        # Verify role changed
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        assert test_user["role"] == "admin"
        
        # 7. Change role back to doctor
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/role?role=doctor", 
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # 8. Admin change user password
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/change-password",
            json={"new_password": "adminchanged123"},
            headers=admin_headers
        )
        assert response.status_code == 200
        
        # Verify user can login with new password
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "adminchanged123"
        })
        assert response.status_code == 200
        
        # 9. Delete the user
        response = requests.delete(f"{BASE_URL}/api/admin/users/{test_user_id}", 
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "eliminado" in response.json()["message"].lower()
        
        # 10. Verify user is deleted
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        assert test_user is None, "User should be deleted"


class TestAdminRejectUser:
    """Test reject user functionality"""
    
    def test_reject_user(self, admin_headers):
        """Test rejecting a user"""
        # Register test user
        test_email = f"TEST_reject_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "TEST Reject User"
        })
        assert response.status_code == 200
        
        # Get user ID
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        assert test_user is not None
        test_user_id = test_user["id"]
        
        # Reject the user
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/reject", 
            headers=admin_headers
        )
        assert response.status_code == 200
        assert "rechazado" in response.json()["message"].lower()
        
        # Verify rejected user cannot login
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": test_email,
            "password": "testpass123"
        })
        assert response.status_code == 403
        assert "rechazada" in response.json()["detail"].lower()
        
        # Cleanup - delete test user
        requests.delete(f"{BASE_URL}/api/admin/users/{test_user_id}", headers=admin_headers)


class TestAdminCannotDeleteSelf:
    """Test admin cannot delete their own account"""
    
    def test_admin_cannot_delete_self(self, admin_headers):
        """Admin cannot delete their own account"""
        # Get admin user ID
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=admin_headers)
        admin_id = response.json()["id"]
        
        # Try to delete self
        response = requests.delete(f"{BASE_URL}/api/admin/users/{admin_id}", 
            headers=admin_headers
        )
        assert response.status_code == 400
        assert "propia cuenta" in response.json()["detail"].lower()


class TestAdminInvalidRole:
    """Test invalid role change"""
    
    def test_invalid_role_returns_400(self, admin_headers):
        """Changing to invalid role returns 400"""
        # Register test user
        test_email = f"TEST_invalid_role_{uuid.uuid4().hex[:8]}@test.com"
        response = requests.post(f"{BASE_URL}/api/auth/register", json={
            "email": test_email,
            "password": "testpass123",
            "name": "TEST Invalid Role"
        })
        assert response.status_code == 200
        
        # Get user ID
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=admin_headers)
        users = response.json()
        test_user = next((u for u in users if u["email"] == test_email), None)
        test_user_id = test_user["id"]
        
        # Try invalid role
        response = requests.put(f"{BASE_URL}/api/admin/users/{test_user_id}/role?role=invalid_role", 
            headers=admin_headers
        )
        assert response.status_code == 400
        
        # Cleanup
        requests.delete(f"{BASE_URL}/api/admin/users/{test_user_id}", headers=admin_headers)


class TestAdminNotFoundErrors:
    """Test 404 errors for non-existent users"""
    
    def test_approve_nonexistent_user_404(self, admin_headers):
        """Approving non-existent user returns 404"""
        response = requests.put(f"{BASE_URL}/api/admin/users/nonexistent-id-123/approve", 
            headers=admin_headers
        )
        assert response.status_code == 404
    
    def test_reject_nonexistent_user_404(self, admin_headers):
        """Rejecting non-existent user returns 404"""
        response = requests.put(f"{BASE_URL}/api/admin/users/nonexistent-id-123/reject", 
            headers=admin_headers
        )
        assert response.status_code == 404
    
    def test_change_password_nonexistent_user_404(self, admin_headers):
        """Changing password for non-existent user returns 404"""
        response = requests.put(f"{BASE_URL}/api/admin/users/nonexistent-id-123/change-password",
            json={"new_password": "test123"},
            headers=admin_headers
        )
        assert response.status_code == 404
    
    def test_change_role_nonexistent_user_404(self, admin_headers):
        """Changing role for non-existent user returns 404"""
        response = requests.put(f"{BASE_URL}/api/admin/users/nonexistent-id-123/role?role=admin", 
            headers=admin_headers
        )
        assert response.status_code == 404
    
    def test_delete_nonexistent_user_404(self, admin_headers):
        """Deleting non-existent user returns 404"""
        response = requests.delete(f"{BASE_URL}/api/admin/users/nonexistent-id-123", 
            headers=admin_headers
        )
        assert response.status_code == 404
