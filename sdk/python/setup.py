from setuptools import setup, find_packages

setup(
    name="ai-logger-sdk",
    version="1.0.0",
    description="Official Python SDK for AI Logger",
    long_description=open("README.md").read(),
    long_description_content_type="text/markdown",
    author="AI Logger",
    license="MIT",
    packages=find_packages(),
    python_requires=">=3.7",
    classifiers=[
        "Programming Language :: Python :: 3",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
    ],
)
