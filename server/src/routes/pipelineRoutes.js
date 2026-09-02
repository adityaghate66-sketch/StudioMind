const express = require('express')
const router = express.Router()
const { createRun, getRun, listRuns } = require('../controllers/pipelineController')

router.post('/runs', createRun)
router.get('/runs/:id', getRun)
router.get('/runs', listRuns)

module.exports = router
