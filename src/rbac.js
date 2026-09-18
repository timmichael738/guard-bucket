
const rbacConfig = (acceptableRoleList, getRole) => {

    if (!acceptableRoleList) {
        throw new Error("ACCEPTABLE_ROLE_LIST_MISSING");
    }

    if (!getRole) {
        throw new Error("GET_ROLE_FUNCTION_MISSING");
    }

    if (!Array.isArray(acceptableRoleList)) {
        throw new Error("INVALID_ACCEPTABLE_ROLE_LIST_DATA_TYPE \n MUST_BE_ARRAY");
    }

    if (typeof getRole !== "function") {
        throw new Error("INVALID_GET_ROLE_DATA_TYPE \n MUST_BE_FUNCTION");
    }

    return (req, res, next) => {

        const role = getRole(req);

        if (!acceptableRoleList.includes(role)) {
           return res.status(403).json({ message: "REQUEST_VIA_INVALID_ROLE" })
        }

        next()
    }
}

module.exports = rbacConfig;