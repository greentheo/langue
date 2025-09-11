from setuptools import setup, find_packages

setup(
    name="langue",
    version="0.1.0",
    packages=find_packages(),
    include_package_data=True,
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
