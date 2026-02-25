from setuptools import setup, find_packages

setup(
    name="regulateai-sdk",
    version="2.0.0",
    description="Official Python SDK for RegulateAI - EU AI Act Compliance Platform",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="RegulateAI",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.8",
    classifiers=[
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.8",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
