/*
 *  Copyright 2026 Collate.
 *  Licensed under the Apache License, Version 2.0 (the "License");
 *  you may not use this file except in compliance with the License.
 *  You may obtain a copy of the License at
 *  http://www.apache.org/licenses/LICENSE-2.0
 *  Unless required by applicable law or agreed to in writing, software
 *  distributed under the License is distributed on an "AS IS" BASIS,
 *  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *  See the License for the specific language governing permissions and
 *  limitations under the License.
 */

/**
 * Test declarations of a Data Quality Rule. Every item becomes one TestCase per Column of the
 * Rule's CDE once the Rule is Approved.
 */
export interface DqTestSpecs {
    /**
     * Declarations in display order. An empty list means the Rule only describes a requirement.
     */
    items?: DqTestSpec[];
    schemaVersion?: number;
}

/**
 * One test declaration of a Data Quality Rule.
 */
export interface DqTestSpec {
    /**
     * Compute passed and failed row counts so that percentage thresholds can be evaluated.
     */
    computePassedFailedRowCount?: boolean;
    /**
     * Server-issued identifier, stable within the Rule identity and never reused. Empty on a new
     * declaration.
     */
    key?: string;
    kind: DqTestSpecKind;
    /**
     * Display name, unique within the Rule (case-insensitive).
     */
    name: string;
    /**
     * Values of the TestDefinition parameters (LIBRARY) or of extra template variables (SQL).
     */
    parameterValues?: TestCaseParameterValue[];
    /**
     * Jinja2 SELECT template returning the violating records, using {{ table_name }} and {{
     * column_name }}. Required for SQL.
     */
    sqlExpression?: string;
    /**
     * Fully qualified name of the column-level TestDefinition. Required for LIBRARY.
     */
    testDefinitionFqn?: string;
    /**
     * Threshold of this declaration. When empty the quality threshold of the Rule applies.
     */
    threshold?: string;
}

/**
 * LIBRARY uses an existing column-level TestDefinition; SQL runs a Rule-owned query that
 * returns the violating records.
 */
export enum DqTestSpecKind {
    Library = "LIBRARY",
    SQL = "SQL",
}

/**
 * This schema defines the parameter values that can be passed for a Test Case.
 */
export interface TestCaseParameterValue {
    /**
     * name of the parameter. Must match the parameter names in testCaseParameterDefinition
     */
    name?: string;
    /**
     * value to be passed for the Parameters. These are input from Users. We capture this in
     * string and convert during the runtime.
     */
    value?: string;
}
