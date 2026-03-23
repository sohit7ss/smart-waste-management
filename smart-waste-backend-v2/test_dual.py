import requests

# Test 1: Single image waste classification
def test_waste_type():
    print("Testing /analyze/waste-type...")
    # use any dummy image
    image_content = b"dummy_image_data_for_testing"
    files = {"file": ("test.jpg", image_content, "image/jpeg")}
    try:
        res = requests.post("http://localhost:8000/analyze/waste-type", files=files)
        print("Status", res.status_code)
        print("Response:", res.json())
        print("✅ /analyze/waste-type passed!\n")
    except Exception as e:
        print("Failed", e)

# Test 2: Dual Analysis
def test_dual_analysis():
    print("Testing /analyze/dual-analysis...")
    image_content = b"dummy_image_data_for_testing"
    files = {"file": ("test.jpg", image_content, "image/jpeg")}
    try:
        res = requests.post("http://localhost:8000/analyze/dual-analysis?bin_id=1", files=files)
        print("Status", res.status_code)
        print("Response:", res.json())
        print("✅ /analyze/dual-analysis passed!\n")
    except Exception as e:
        print("Failed", e)

if __name__ == "__main__":
    test_waste_type()
    test_dual_analysis()
