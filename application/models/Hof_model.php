<?php
/**
 * SharIF Judge online judge
 * @file Hof_model.php
 * @author Stillmen Vallian <stillmen.v@gmail.com>
 */
defined('BASEPATH') OR exit('No direct script access allowed');

class Hof_model extends CI_Model
{

	public function __construct()
	{
		parent::__construct();
	}


	// ------------------------------------------------------------------------


	/**
	 * Get data for Hall of Fame
	 *
	 *
	 * @return mixed
	 */
	public function get_all_final_submission()
	{
    return $this->db->query("SELECT username, SUM(pre_score * coefficient / 100) AS totalscore FROM shj_submissions WHERE is_final=1 GROUP BY username")->result_array();
	}


	// ------------------------------------------------------------------------

	/**
	 *
	 *
	 *
	 * @return mixed
	 */
	public function get_all_user_assignments($username)
	{
		$this->load->model('assignment_model');
    $details = $this->db->query("SELECT assignment, SUM(pre_score * coefficient / 100) AS totalscore FROM shj_submissions WHERE is_final=1 AND username='$username' GROUP BY assignment")->result_array();

		foreach ($details as $key => $detail) {
			$assignment_id = $detail['assignment'];
			$details[$key]['assignment'] = $this->assignment_model->assignment_info($assignment_id)['name'];
    }
		return $details;
	}
}
