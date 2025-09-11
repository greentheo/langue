from setuptools import setup, find_packages
import os
import shutil
import glob

# Create package data directories if they don't exist
os.makedirs("langue/data/flashcard_libraries", exist_ok=True)

# Copy flashcard libraries if they exist
source_libraries = "data/flashcard_libraries"
target_libraries = "langue/data/flashcard_libraries"

if os.path.exists(source_libraries):
    # Copy language directories
    for lang_dir in glob.glob(f"{source_libraries}/*"):
        if os.path.isdir(lang_dir):
            lang_name = os.path.basename(lang_dir)
            target_lang_dir = os.path.join(target_libraries, lang_name)
            os.makedirs(target_lang_dir, exist_ok=True)

            # Copy JSON files
            for json_file in glob.glob(f"{lang_dir}/*.json"):
                target_file = os.path.join(target_lang_dir, os.path.basename(json_file))
                shutil.copy2(json_file, target_file)
                print(f"Copied {json_file} to {target_file}")

setup(
    name="langue",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
    package_data={
        "langue": ["data/flashcard_libraries/**/*.json"],
    },
    install_requires=[
        "click>=8.0.0",
        "rich>=10.0.0",
        "pydantic>=2.0.0",
        "requests>=2.25.0",
        "toml>=0.10.2",
        "anthropic>=0.5.0",
        "openai>=1.0.0",
        "python-dotenv>=0.19.0",
        "sqlalchemy>=2.0.0",
        "questionary>=1.10.0",
    ],
    entry_points={
        "console_scripts": [
            "langue=langue.main:main",
        ],
    },
    python_requires=">=3.10",
    author="Langue Team",
    author_email="info@langue.dev",
    description="A CLI language learning application powered by AI models",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    url="https://github.com/yourusername/langue",
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Education",
        "License :: OSI Approved :: MIT License",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.10",
        "Topic :: Education",
    ],
)
