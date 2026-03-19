"""
Test photo upload feature and auth endpoints
- POST /api/auth/upload-photo - Upload profile photo
- GET /api/auth/me - Returns photo_url field
- GET /api/uploads/photos/{filename} - Serves uploaded photo
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')

class TestPhotoUpload:
    """Photo upload and profile photo display tests"""
    
    @pytest.fixture(scope="class")
    def auth_token(self):
        """Get authentication token for admin user"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "admin123"
        })
        assert response.status_code == 200, f"Login failed: {response.text}"
        return response.json()["token"]
    
    @pytest.fixture(scope="class")
    def auth_headers(self, auth_token):
        """Get auth headers"""
        return {"Authorization": f"Bearer {auth_token}"}
    
    def test_login_success(self):
        """Test admin login works"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        data = response.json()
        assert "token" in data
        assert "doctor" in data
        assert data["doctor"]["email"] == "admin@test.com"
        print("✅ Login successful")
    
    def test_get_current_doctor_with_photo_url(self, auth_headers):
        """Test GET /api/auth/me returns photo_url field"""
        response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert response.status_code == 200, f"GET /auth/me failed: {response.text}"
        data = response.json()
        
        # Check required fields
        assert "id" in data
        assert "email" in data
        assert "name" in data
        assert "role" in data
        
        # Check photo_url field exists (may be null for users without photo)
        assert "photo_url" in data, "photo_url field missing from response"
        
        # If user has photo, verify URL format
        if data.get("photo_url"):
            assert data["photo_url"].startswith("/api/uploads/photos/"), f"Unexpected photo_url format: {data['photo_url']}"
            print(f"✅ GET /auth/me returned photo_url: {data['photo_url']}")
        else:
            print("✅ GET /auth/me returned photo_url field (null/empty)")
    
    def test_upload_photo_endpoint(self, auth_headers):
        """Test POST /api/auth/upload-photo"""
        # Create a small test image (1x1 pixel PNG)
        import base64
        # Minimal valid PNG (1x1 transparent pixel)
        png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        png_bytes = base64.b64decode(png_base64)
        
        files = {
            'file': ('test_photo.png', png_bytes, 'image/png')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/upload-photo",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 200, f"Upload photo failed: {response.text}"
        data = response.json()
        assert "photo_url" in data
        assert data["photo_url"].startswith("/api/uploads/photos/")
        print(f"✅ Photo upload successful: {data['photo_url']}")
        
        # Return photo_url for next test
        return data["photo_url"]
    
    def test_photo_upload_updates_doctor_record(self, auth_headers):
        """Test that uploaded photo is persisted in doctor record"""
        # Upload a photo first
        import base64
        png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        png_bytes = base64.b64decode(png_base64)
        
        files = {'file': ('test_photo.png', png_bytes, 'image/png')}
        upload_response = requests.post(
            f"{BASE_URL}/api/auth/upload-photo",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        assert upload_response.status_code == 200
        uploaded_url = upload_response.json()["photo_url"]
        
        # Verify GET /auth/me shows updated photo
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200
        doctor_data = me_response.json()
        
        assert doctor_data.get("photo_url") == uploaded_url, \
            f"Photo URL not persisted. Expected: {uploaded_url}, Got: {doctor_data.get('photo_url')}"
        print(f"✅ Photo URL persisted in doctor record: {doctor_data['photo_url']}")
    
    def test_serve_uploaded_photo(self, auth_headers):
        """Test GET /api/uploads/photos/{filename} serves the photo"""
        # First get the photo URL from auth/me
        me_response = requests.get(f"{BASE_URL}/api/auth/me", headers=auth_headers)
        assert me_response.status_code == 200
        photo_url = me_response.json().get("photo_url")
        
        if not photo_url:
            pytest.skip("No photo uploaded for user")
        
        # Fetch the photo
        full_url = f"{BASE_URL}{photo_url}"
        photo_response = requests.get(full_url)
        
        assert photo_response.status_code == 200, f"Failed to fetch photo from {full_url}: {photo_response.status_code}"
        assert photo_response.headers.get("content-type", "").startswith("image/"), \
            f"Unexpected content-type: {photo_response.headers.get('content-type')}"
        assert len(photo_response.content) > 0, "Photo content is empty"
        print(f"✅ Photo served successfully from {full_url} ({len(photo_response.content)} bytes)")
    
    def test_upload_photo_rejects_non_image(self, auth_headers):
        """Test that non-image files are rejected"""
        files = {
            'file': ('test.txt', b'This is not an image', 'text/plain')
        }
        
        response = requests.post(
            f"{BASE_URL}/api/auth/upload-photo",
            headers={"Authorization": auth_headers["Authorization"]},
            files=files
        )
        
        assert response.status_code == 400, f"Expected 400 for non-image, got {response.status_code}"
        print("✅ Non-image file correctly rejected")
    
    def test_upload_photo_requires_auth(self):
        """Test that photo upload requires authentication"""
        import base64
        png_base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
        png_bytes = base64.b64decode(png_base64)
        
        files = {'file': ('test_photo.png', png_bytes, 'image/png')}
        response = requests.post(f"{BASE_URL}/api/auth/upload-photo", files=files)
        
        assert response.status_code in [401, 403], f"Expected 401/403 without auth, got {response.status_code}"
        print("✅ Photo upload correctly requires authentication")


class TestDashboardAndAuth:
    """Test dashboard and auth endpoints continue to work"""
    
    @pytest.fixture(scope="class")
    def auth_headers(self):
        """Get auth headers"""
        response = requests.post(f"{BASE_URL}/api/auth/login", json={
            "email": "admin@test.com",
            "password": "admin123"
        })
        assert response.status_code == 200
        return {"Authorization": f"Bearer {response.json()['token']}"}
    
    def test_dashboard_stats(self, auth_headers):
        """Test dashboard stats endpoint"""
        response = requests.get(f"{BASE_URL}/api/dashboard/stats", headers=auth_headers)
        assert response.status_code == 200
        data = response.json()
        assert "total_patients" in data
        assert "appointments_today" in data
        print("✅ Dashboard stats working")
    
    def test_patients_list(self, auth_headers):
        """Test patients endpoint"""
        response = requests.get(f"{BASE_URL}/api/patients", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✅ Patients list working")
    
    def test_appointments_list(self, auth_headers):
        """Test appointments endpoint"""
        response = requests.get(f"{BASE_URL}/api/appointments", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✅ Appointments list working")
    
    def test_admin_users_list(self, auth_headers):
        """Test admin users endpoint"""
        response = requests.get(f"{BASE_URL}/api/admin/users", headers=auth_headers)
        assert response.status_code == 200
        assert isinstance(response.json(), list)
        print("✅ Admin users list working")


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
